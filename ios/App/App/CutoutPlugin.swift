import Foundation
import Capacitor
import CoreML
import CoreImage
import UIKit

/**
 * On-device background removal for the iOS app. The Core ML model is compiled
 * and bundled into the app at build time, so there is NO network download at
 * runtime. Web users keep using the WASM/transformers.js pipeline instead.
 */
@objc(CutoutPlugin)
public class CutoutPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "CutoutPlugin"
    public let jsName = "CutoutPlugin"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "cutout", returnType: CAPPluginReturnPromise)
    ]

    private let size = 1024
    private let mean: [Float] = [0.485, 0.456, 0.406]
    private let std: [Float] = [0.229, 0.224, 0.225]
    private var cachedModel: MLModel?

    private func getModel() throws -> MLModel {
        if let m = cachedModel { return m }
        guard let resourcePath = Bundle.main.resourcePath else {
            throw NSError(domain: "CutoutPlugin", code: 1, userInfo: [NSLocalizedDescriptionKey: "bundle resource path missing"])
        }
        let contents = (try? FileManager.default.contentsOfDirectory(atPath: resourcePath)) ?? []
        guard let dir = contents.first(where: { $0.hasSuffix(".mlmodelc") }) else {
            throw NSError(domain: "CutoutPlugin", code: 2, userInfo: [NSLocalizedDescriptionKey: "bundled Core ML model not found"])
        }
        let config = MLModelConfiguration()
        config.computeUnits = .cpuOnly
        let m = try MLModel(contentsOf: URL(fileURLWithPath: resourcePath).appendingPathComponent(dir), configuration: config)
        cachedModel = m
        return m
    }

    @objc func cutout(_ call: CAPPluginCall) {
        DispatchQueue.global(qos: .userInitiated).async {
            do {
                guard let dataUrl = call.getString("image"), !dataUrl.isEmpty else {
                    DispatchQueue.main.async { call.reject("image data URL required") }
                    return
                }
                let base64: String
                if let comma = dataUrl.firstIndex(of: ",") {
                    base64 = String(dataUrl[dataUrl.index(after: comma)...])
                } else {
                    base64 = dataUrl
                }
                guard let data = Data(base64Encoded: base64),
                      let image = UIImage(data: data),
                      let cg = image.cgImage else {
                    DispatchQueue.main.async { call.reject("invalid image data") }
                    return
                }

                let w = self.size, h = self.size
                let colorSpace = CGColorSpaceCreateDeviceRGB()
                guard let srcCtx = CGContext(data: nil, width: w, height: h, bitsPerComponent: 8,
                                             bytesPerRow: 0, space: colorSpace,
                                             bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue),
                      let srcData = srcCtx.data else {
                    throw NSError(domain: "CutoutPlugin", code: 3, userInfo: [NSLocalizedDescriptionKey: "cannot allocate pixel buffer"])
                }
                srcCtx.interpolationQuality = .high
                srcCtx.draw(cg, in: CGRect(x: 0, y: 0, width: w, height: h))
                let srcPtr = srcData.bindMemory(to: UInt8.self, capacity: w * h * 4)

                guard let inputArray = try? MLMultiArray(shape: [1, 3, NSNumber(value: h), NSNumber(value: w)],
                                                         dataType: .float32) else {
                    throw NSError(domain: "CutoutPlugin", code: 4, userInfo: [NSLocalizedDescriptionKey: "cannot allocate input tensor"])
                }
                let n = w * h
                let inputPtr = inputArray.dataPointer.assumingMemoryBound(to: Float.self)
                for i in 0..<n {
                    let r = Float(srcPtr[i * 4]) / 255
                    let g = Float(srcPtr[i * 4 + 1]) / 255
                    let b = Float(srcPtr[i * 4 + 2]) / 255
                    inputPtr[i] = (r - self.mean[0]) / self.std[0]
                    inputPtr[n + i] = (g - self.mean[1]) / self.std[1]
                    inputPtr[2 * n + i] = (b - self.mean[2]) / self.std[2]
                }

                let model = try self.getModel()
                let inputName = model.modelDescription.inputDescriptionsByName.keys.first ?? "image"
                let provider = try MLDictionaryFeatureProvider(dictionary: [
                    inputName: MLFeatureValue(multiArray: inputArray)
                ])
                let output = try model.prediction(from: provider)
                let outputName = output.featureValue(for: "mask_logits") != nil
                    ? "mask_logits"
                    : (model.modelDescription.outputDescriptionsByName.keys.first ?? "")
                guard let mask = output.featureValue(for: outputName)?.multiArrayValue else {
                    throw NSError(domain: "CutoutPlugin", code: 5, userInfo: [NSLocalizedDescriptionKey: "model returned no mask"])
                }
                let maskPtr = mask.dataPointer.assumingMemoryBound(to: Float.self)

                guard let outCtx = CGContext(data: nil, width: w, height: h, bitsPerComponent: 8,
                                             bytesPerRow: 0, space: colorSpace,
                                             bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue),
                      let outData = outCtx.data else {
                    throw NSError(domain: "CutoutPlugin", code: 6, userInfo: [NSLocalizedDescriptionKey: "cannot allocate output buffer"])
                }
                let outPtr = outData.bindMemory(to: UInt8.self, capacity: w * h * 4)
                for i in 0..<n {
                    let v = maskPtr[i]
                    let a = UInt8(max(0, min(255, Int((1 / (1 + exp(-Double(v)))) * 255))))
                    outPtr[i * 4] = srcPtr[i * 4]
                    outPtr[i * 4 + 1] = srcPtr[i * 4 + 1]
                    outPtr[i * 4 + 2] = srcPtr[i * 4 + 2]
                    outPtr[i * 4 + 3] = a
                }
                guard let small = outCtx.makeImage() else {
                    throw NSError(domain: "CutoutPlugin", code: 7, userInfo: [NSLocalizedDescriptionKey: "cannot create mask image"])
                }
                let ow = Int(cg.width), oh = Int(cg.height)
                guard let finalCtx = CGContext(data: nil, width: ow, height: oh, bitsPerComponent: 8,
                                               bytesPerRow: 0, space: colorSpace,
                                               bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue) else {
                    throw NSError(domain: "CutoutPlugin", code: 8, userInfo: [NSLocalizedDescriptionKey: "cannot allocate final buffer"])
                }
                finalCtx.interpolationQuality = .high
                finalCtx.draw(small, in: CGRect(x: 0, y: 0, width: ow, height: oh))
                guard let finalCG = finalCtx.makeImage(),
                      let png = UIImage(cgImage: finalCG).pngData() else {
                    throw NSError(domain: "CutoutPlugin", code: 9, userInfo: [NSLocalizedDescriptionKey: "cannot encode PNG"])
                }
                let result = "data:image/png;base64," + png.base64EncodedString()
                DispatchQueue.main.async { call.resolve(["image": result]) }
            } catch {
                DispatchQueue.main.async { call.reject("cutout failed: \(error.localizedDescription)") }
            }
        }
    }
}
