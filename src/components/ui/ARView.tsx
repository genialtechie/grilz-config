import React, { useState, useEffect, useRef } from 'react';
import { FaceMesh, Results } from '@mediapipe/face_mesh';
import ARScene from '../three/ARScene';
import { ToothCustomization } from '../../lib/types';

interface ARViewProps {
  onBack: () => void;
  customizations: ToothCustomization[];
}

const ARView: React.FC<ARViewProps> = ({ onBack, customizations }) => {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [started, setStarted] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const faceMeshRef = useRef<FaceMesh | null>(null);

  // Hold latest mediapipe results in a ref to avoid 60hz React setState
  const faceMeshResultsRef = useRef<Results | null>(null);

  useEffect(() => {
    // Prevent embedded preview
    if (window.self !== window.top) {
      setError('Open AR in a standalone browser tab (http://localhost)');
      return;
    }
    // Require secure context
    if (!window.isSecureContext) {
      setError('AR requires HTTPS or localhost');
      return;
    }
    // Enumerate cameras
    if (!navigator.mediaDevices?.enumerateDevices) {
      setError('Media devices enumeration not supported');
      return;
    }
    navigator.mediaDevices.enumerateDevices()
      .then(devs => {
        const cams = devs.filter(d => d.kind === 'videoinput');
        if (cams.length === 0) {
          setError('No camera devices found');
        } else {
          setDevices(cams);
          setSelectedDeviceId(cams[0].deviceId);
        }
      })
      .catch(err => setError('Failed to list cameras: ' + err.message));
  }, []);

  const startAR = () => {
    if (error) return;
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Camera API not supported');
      return;
    }
    const constraints: MediaStreamConstraints = selectedDeviceId
      ? { video: { deviceId: { exact: selectedDeviceId } } }
      : { video: true };
    // Helper to initialize camera stream and FaceMesh
    const initCamera = (stream: MediaStream) => {
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      const fm = new FaceMesh({ locateFile: file => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}` });
      fm.setOptions({ maxNumFaces: 1, refineLandmarks: true, minDetectionConfidence: 0.5, minTrackingConfidence: 0.5 });
      fm.onResults(onResults);
      faceMeshRef.current = fm;
      ;(async function process() {
        if (videoRef.current) await fm.send({ image: videoRef.current });
        requestAnimationFrame(process);
      })();
      setStarted(true);
    };
    navigator.mediaDevices.getUserMedia(constraints)
      .then(initCamera)
      .catch(err => {
        // Fallback on missing or mismatched device
        if (err.name === 'NotFoundError' || err.name === 'OverconstrainedError') {
          console.warn('Device constraint failed, falling back to default camera', err);
          return navigator.mediaDevices.getUserMedia({ video: true }).then(initCamera);
        }
        throw err;
      })
      .catch(err => setError('Unable to access camera: ' + err.message));
  };

  const onResults = (results: Results) => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    // No overlay box in AR mode; only video feed
    faceMeshResultsRef.current = results;
  };

  return (
    <div className="h-screen bg-gray-50 flex flex-col items-center py-4 px-4 overflow-hidden">
      <button onClick={onBack} className="self-start mb-6 p-2 bg-white rounded-full shadow">
        ←
      </button>
      {/* Video Preview Container */}
      <div className="w-full max-w-lg h-[60vh] bg-black rounded-xl overflow-hidden shadow-lg relative">
        <canvas ref={canvasRef} className="w-full h-full object-cover" />
        {started && (
          <ARScene faceMeshResultsRef={faceMeshResultsRef} customizations={customizations} />
        )}
      </div>
      {/* Controls (hidden once AR starts) */}
      {!started && (
        <div className="w-full max-w-md mt-8 bg-white rounded-lg shadow p-6">
          {error ? (
            <p className="text-red-500 text-center">{error}</p>
          ) : !videoRef.current?.srcObject ? (
            <>            
              <div className="mb-4">
                <label className="block text-gray-700 font-medium mb-2">Select Camera</label>
                <select
                  value={selectedDeviceId}
                  onChange={e => setSelectedDeviceId(e.target.value)}
                  className="block w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {devices.map(d => (
                    <option key={d.deviceId} value={d.deviceId}>
                      {d.label || `Camera ${d.deviceId}`}
                    </option>
                  ))}
                </select>
              </div>
              <button
                onClick={startAR}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition duration-150"
              >
                Start AR
              </button>
            </>
          ) : null}
        </div>
      )}
      {/* Hidden video element for processing */}
      <video ref={videoRef} className="hidden" playsInline muted />
    </div>
  );
};

export default ARView;
