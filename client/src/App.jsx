import { useState, useRef } from 'react';
import axios from 'axios';
import { Mic, Square, Play, Send, Loader2 } from 'lucide-react';

function App() {

  const [isRecording, setIsRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState(null);
  const [audioBlob, setAudioBlob] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [transcript, setTranscript] = useState("");

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);


  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      const mediaRecorder = new MediaRecorder(stream);

      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });

        const url = URL.createObjectURL(blob);

        setAudioUrl(url);
        setAudioBlob(blob);
        audioChunksRef.current = [];
      };

      mediaRecorder.start();
      setIsRecording(true);

    } catch (error) {
      console.error("Error accessing microphone:", error);
      alert("Microphone permission denied!");
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current.stop();
    setIsRecording(false);
  };

  const uploadAudio = async () => {
    if (!audioBlob) return;
    setIsUploading(true);
    setTranscript("");

    const formData = new FormData();
    formData.append("audio", audioBlob, "recording.webm");

    try {
      const response = await axios.post('http://localhost:3000/api/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      console.log("Uploaded Successfully: ", response.data);
      setTranscript(response.data.transcript);

      alert(response.data.filename);

    } catch (error) {
      console.error("Upload failed: ", error);
      alert("Upload failed! Check Node Console.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-4">
      <h1 className="text-3xl font-bold mb-8">Interview Audio Test</h1>

      <div className="flex flex-col items-center gap-6">

        {/* Record/Stop Button Logic */}
        {!isRecording ? (
          <button onClick={startRecording} className="w-24 h-24 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center shadow-lg transition-all hover:scale-105">
            <Mic size={40} className="text-white" />
          </button>
        ) : (
          <button onClick={stopRecording} className="w-24 h-24 rounded-full bg-gray-700 hover:bg-gray-600 flex items-center justify-center shadow-lg animate-pulse">
            <Square size={40} className="text-white" />
          </button>
        )}

        <p className="text-gray-400">
          {isRecording ? "Listening... (Click to Stop)" : "Click mic to record"}
        </p>

        {/* Playback & Upload Section */}
        {audioUrl && (
          <div className="mt-6 p-4 bg-gray-800 rounded-lg flex flex-col items-center gap-4 w-full max-w-md">
            <h3 className="text-sm font-semibold text-gray-300">Playback Preview</h3>
            <audio src={audioUrl} controls className="w-full" />

            {/* The Upload Button */}
            <button
              onClick={uploadAudio}
              disabled={isUploading} // Disable button while uploading
              className="flex items-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-full font-medium transition-colors disabled:opacity-50"
            >
              {isUploading ? (
                <>
                  <Loader2 className="animate-spin" size={18} /> Uploading...
                </>
              ) : (
                <>
                  <Send size={18} /> Submit to Backend
                </>
              )}
            </button>
          </div>
        )}

        {/* Only show this box if we actually have text in 'transcript' */}
        {transcript && (
          <div className="mt-8 p-6 bg-white rounded-lg shadow-lg w-full max-w-2xl text-gray-800 animate-fade-in">
            <h2 className="text-xl font-bold mb-4 border-b border-gray-300 pb-2 text-blue-600">
              AI Transcript:
            </h2>
            <p className="whitespace-pre-wrap leading-relaxed text-lg">
              {transcript}
            </p>
          </div>
        )}

      </div>
    </div>
  );
}

export default App;