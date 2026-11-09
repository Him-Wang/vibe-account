use crate::storage::{Config, Expense};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::time::Duration;

const CATEGORIES: [&str; 9] = [
    "餐饮", "交通", "购物", "娱乐", "居家", "医疗", "教育", "人情", "其他",
];

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Draft {
    pub amount_cents: i64,
    pub category: String,
    pub note: String,
    pub date: String,
}

pub fn draft_to_expense(d: Draft, today: &str) -> Option<Expense> {
    let d = sanitize(d.amount_cents, &d.category, &d.note, &d.date, today)?;
    Some(Expense {
        id: uuid::Uuid::new_v4().to_string(),
        amount_cents: d.amount_cents,
        category: d.category,
        note: d.note,
        date: d.date,
        created_at: chrono::Local::now().to_rfc3339(),
    })
}

fn sanitize(cents: i64, category: &str, note: &str, date: &str, today: &str) -> Option<Draft> {
    if cents <= 0 || cents > 100_000_000 {
        return None;
    }
    let category = CATEGORIES
        .iter()
        .find(|c| **c == category.trim())
        .map(|c| c.to_string())
        .unwrap_or_else(|| "其他".to_string());
    let date = if chrono::NaiveDate::parse_from_str(date.trim(), "%Y-%m-%d").is_ok() {
        date.trim().to_string()
    } else {
        today.to_string()
    };
    let note: String = note.trim().chars().take(60).collect();
    Some(Draft {
        amount_cents: cents,
        category,
        note,
        date,
    })
}

pub async fn parse(cfg: &Config, key: &str, text: &str) -> Result<Vec<Draft>, String> {
    let text = text.trim();
    if text.is_empty() {
        return Err("请先输入一段消费描述。".to_string());
    }

    let url = endpoint(&cfg.base_url);
    let model = if cfg.model.trim().is_empty() {
        "deepseek-chat"
    } else {
        cfg.model.trim()
    };
    let today = chrono::Local::now().format("%Y-%m-%d").to_string();
    let system = system_prompt(&today);

    let body = serde_json::json!({
        "model": model,
        "temperature": 0,
        "messages": [
            { "role": "system", "content": system },
            { "role": "user", "content": text }
        ]
    });

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(60))
        .build()
        .map_err(|e| format!("网络客户端初始化失败：{e}"))?;

    let resp = client
        .post(&url)
        .bearer_auth(key)
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("网络请求失败：{e}。请检查网络连接和 Base URL。"))?;

    let status = resp.status();
    let raw = resp
        .text()
        .await
        .map_err(|e| format!("读取接口响应失败：{e}"))?;

    if !status.is_success() {
        return Err(http_error(status.as_u16(), &raw));
    }

    let value: Value = serde_json::from_str(&raw)
        .map_err(|_| format!("接口返回的不是 JSON：{}", truncate(&raw, 160)))?;

    let content = value
        .pointer("/choices/0/message/content")
        .and_then(|c| c.as_str())
        .ok_or_else(|| {
            format!(
                "接口返回缺少 choices[0].message.content：{}",
                truncate(&raw, 160)
            )
        })?;

    let json_text = extract_json(content)
        .ok_or_else(|| "大模型没有返回 JSON。请重试，或换一个更擅长指令的模型。".to_string())?;

    parse_drafts(&json_text, &today)
}

fn endpoint(base: &str) -> String {
    let b = base.trim().trim_end_matches('/');
    if b.ends_with("/chat/completions") {
        b.to_string()
    } else if b.ends_with("/v1") {
        format!("{b}/chat/completions")
    } else {
        format!("{b}/v1/chat/completions")
    }
}

fn system_prompt(today: &str) -> String {
    format!(
        "你是一个精确的记账解析器。把用户口述的消费拆成多笔支出。\n\
只输出一个 JSON 对象，不要 Markdown、不要解释、不要多余文字。\n\
格式：{{\"expenses\":[{{\"amount\":12.5,\"category\":\"餐饮\",\"note\":\"早饭\",\"date\":\"{today}\"}}]}}\n\
规则：\n\
1. amount 单位是元，正数，最多两位小数。\n\
2. category 只能是：餐饮、交通、购物、娱乐、居家、医疗、教育、人情、其他。\n\
3. note 用不超过 12 个字的短语概括这笔消费。\n\
4. 用户没提日期时，date 用 {today}；提到“昨天/前天”时换算成具体日期。\n\
5. 一句话里有多笔消费就拆成多条，不要合并。\n\
6. 忽略与消费金额无关的内容；无法确定金额的条目不要输出。\n\
7. 不要输出收入、转账、退款。"
    )
}

fn extract_json(content: &str) -> Option<String> {
    let t = content.trim();
    let body = if let Some(start) = t.find("```") {
        let after = &t[start + 3..];
        let after = after.strip_prefix("json").unwrap_or(after);
        match after.find("```") {
            Some(end) => after[..end].trim(),
            None => after.trim(),
        }
    } else {
        t
    };
    let start = body.find('{')?;
    let end = body.rfind('}')?;
    if end <= start {
        return None;
    }
    Some(body[start..=end].to_string())
}

fn parse_drafts(s: &str, today: &str) -> Result<Vec<Draft>, String> {
    let value: Value = serde_json::from_str(s)
        .map_err(|_| "大模型返回的内容不是合法 JSON，请重试。".to_string())?;

    let arr = value
        .get("expenses")
        .and_then(|x| x.as_array())
        .or_else(|| value.as_array())
        .ok_or_else(|| "大模型返回缺少 expenses 数组，请重试。".to_string())?;

    let mut out = Vec::new();
    for item in arr.iter().take(50) {
        let Some(cents) = item.get("amount").and_then(amount_cents) else {
            continue;
        };
        let category = item.get("category").and_then(|x| x.as_str()).unwrap_or("其他");
        let note = item.get("note").and_then(|x| x.as_str()).unwrap_or("");
        let date = item.get("date").and_then(|x| x.as_str()).unwrap_or(today);
        if let Some(draft) = sanitize(cents, category, note, date, today) {
            out.push(draft);
        }
    }

    if out.is_empty() {
        return Err("没有解析出有效支出。请说清楚金额，例如：早饭 12 元。".to_string());
    }
    Ok(out)
}

fn amount_cents(v: &Value) -> Option<i64> {
    let n = match v {
        Value::Number(n) => n.as_f64()?,
        Value::String(s) => {
            let cleaned: String = s
                .chars()
                .filter(|c| c.is_ascii_digit() || *c == '.' || *c == '-')
                .collect();
            cleaned.parse::<f64>().ok()?
        }
        _ => return None,
    };
    if !n.is_finite() {
        return None;
    }
    Some((n * 100.0).round() as i64)
}

fn http_error(code: u16, body: &str) -> String {
    match code {
        401 | 403 => format!("API Key 无效或没有权限（HTTP {code}）。请在设置里检查 Key。"),
        404 => "接口地址不存在（HTTP 404）。Base URL 一般填到 /v1 即可，例如 https://api.deepseek.com/v1。".to_string(),
        429 => "请求太频繁或额度不足（HTTP 429）。稍后再试。".to_string(),
        500..=599 => format!("服务端暂时不可用（HTTP {code}），稍后再试。"),
        _ => format!("接口返回错误（HTTP {code}）：{}", truncate(body.trim(), 180)),
    }
}

fn truncate(s: &str, max: usize) -> String {
    let mut out: String = s.chars().take(max).collect();
    if s.chars().count() > max {
        out.push('…');
    }
    out
}
