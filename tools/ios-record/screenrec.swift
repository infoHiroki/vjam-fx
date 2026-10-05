// iPad(USB)の画面を録画する:CoreMediaIO で画面キャプチャのデバイスを許可 → AVCaptureSession で mov に書く
// usage: screenrec <out.mov> <seconds>   (list だけなら: screenrec --list)
import AVFoundation
import CoreMediaIO

var prop = CMIOObjectPropertyAddress(mSelector: CMIOObjectPropertySelector(kCMIOHardwarePropertyAllowScreenCaptureDevices),
                                     mScope: CMIOObjectPropertyScope(kCMIOObjectPropertyScopeGlobal),
                                     mElement: CMIOObjectPropertyElement(kCMIOObjectPropertyElementMain))
var allow: UInt32 = 1
CMIOObjectSetPropertyData(CMIOObjectID(kCMIOObjectSystemObject), &prop, 0, nil, UInt32(MemoryLayout<UInt32>.size), &allow)

func devices() -> [AVCaptureDevice] {
  AVCaptureDevice.DiscoverySession(deviceTypes: [.external], mediaType: .muxed, position: .unspecified).devices +
  AVCaptureDevice.DiscoverySession(deviceTypes: [.external], mediaType: .video, position: .unspecified).devices
}
var found: AVCaptureDevice? = nil
for _ in 0..<20 {
  found = devices().first { $0.modelID == "iOS Device" || $0.localizedName.lowercased().contains("ipad") }
  if found != nil { break }
  RunLoop.current.run(until: Date().addingTimeInterval(0.5))
}
let args = CommandLine.arguments
if args.count > 1 && args[1] == "--list" {
  for d in devices() { print(d.localizedName, "|", d.modelID, "|", d.uniqueID) }
  exit(0)
}
guard let dev = found else { print("no iPad device"); exit(1) }
print("device:", dev.localizedName)
let out = URL(fileURLWithPath: args[1]); let secs = Double(args[2]) ?? 60
try? FileManager.default.removeItem(at: out)
let session = AVCaptureSession()
let input = try AVCaptureDeviceInput(device: dev)
session.addInput(input)
let output = AVCaptureMovieFileOutput()
session.addOutput(output)
final class Delegate: NSObject, AVCaptureFileOutputRecordingDelegate {
  var done = false
  func fileOutput(_ o: AVCaptureFileOutput, didFinishRecordingTo url: URL, from c: [AVCaptureConnection], error: Error?) {
    print("finished:", url.path, error.map { "\($0)" } ?? "ok"); done = true
  }
}
let del = Delegate()
session.startRunning()
RunLoop.current.run(until: Date().addingTimeInterval(1.5))
output.startRecording(to: out, recordingDelegate: del)
print("recording", secs, "s START", Date().timeIntervalSince1970)
RunLoop.current.run(until: Date().addingTimeInterval(secs))
output.stopRecording()
while !del.done { RunLoop.current.run(until: Date().addingTimeInterval(0.2)) }
session.stopRunning()
