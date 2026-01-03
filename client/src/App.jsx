import { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { Mic, Square, Play, Send, Loader2 } from 'lucide-react';

function App() {

  const [isRecording, setIsRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState(null);
  const [audioBlob, setAudioBlob] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [analysis, setAnalysis] = useState("");
  const [history, setHistory] = useState([]);
  const [selectedTopic, setSelectedTopic] = useState('general');


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
    formData.append("topic", selectedTopic);

    try {
      const response = await axios.post('http://localhost:3000/api/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      console.log("Uploaded Successfully: ", response.data);
      setTranscript(response.data.transcript);
      setAnalysis(response.data.analysis);

      alert("Transcription Completed!");

    } catch (error) {
      console.error("Upload failed: ", error);
      alert("Upload failed! Check Node Console.");
    } finally {
      setIsUploading(false);
    }
  };

  const fetchHistory = async () => {
    try {
      const response = await axios.get('http://localhost:3000/api/history');

      // DEBUG: Look at this in your browser console (F12)
      console.log("Raw History Data:", response.data);

      // SAFETY CHECK 1: Is response.data an array?
      if (Array.isArray(response.data)) {
        setHistory(response.data);
      }
      // SAFETY CHECK 2: Is it inside a property like response.data.rows?
      else if (response.data && Array.isArray(response.data.rows)) {
        setHistory(response.data.rows);
      }
      // FALLBACK: If it's neither, use empty list to prevent crash
      else {
        console.error("Data format is wrong. Resetting to empty.");
        setHistory([]);
      }

    } catch (error) {
      console.error("Error fetching history:", error);
      setHistory([]); // Always default to empty array on error
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const handleTopicChange = (e) => {
    setSelectedTopic(e.target.value);
    console.log("Topic Selected:", e.target.value);
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-4">
      <h1 className="text-3xl font-bold mb-8">Interview Audio Test</h1>

      <div className="flex flex-col items-center gap-6">

        <div className="topic-selector" style={{ marginBottom: "20px" }}>
          <label htmlFor="topic-select" style={{ marginRight: "10px", fontWeight: "bold" }}>
            Select Interview Topic:
          </label>
          <select
            id="topic-select"
            value={selectedTopic}
            onChange={handleTopicChange}
            style={{ padding: "8px", borderRadius: "5px", border: "1px solid #ccc", color:'black',backgroundColor:'white' }}
          >
            <option value="General">General / Behavioral</option>
            <option value="React">React.js</option>
            <option value="NodeJS">Node.js</option>
            <option value="Python">Python</option>
            <option value="SQL">SQL & Databases</option>
            <option value="DSA">Data Structures & Algorithms</option>
          </select>
        </div>

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
        {/* <--- NEW SECTION: AI REPORT CARD ---> */}
        {analysis && (
          <div className="mt-8 p-6 bg-slate-800 rounded-xl shadow-2xl w-full max-w-2xl border border-slate-700 animate-fade-in">

            {/* Header with Score */}
            <div className="flex items-center justify-between mb-6 border-b border-slate-600 pb-4">
              <h2 className="text-2xl font-bold text-white">AI Analysis</h2>

              {/* Dynamic Color: Green if score > 7, else Red */}
              <div className={`px-4 py-2 rounded-full font-bold text-xl ${analysis.score >= 7 ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
                }`}>
                Score: {analysis.score}/10
              </div>
            </div>

            {/* Feedback Section */}
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2">
                Feedback
              </h3>
              <p className="text-gray-300 leading-relaxed bg-slate-900/50 p-4 rounded-lg">
                {analysis.feedback}
              </p>
            </div>

            {/* Better Answer Section */}
            <div>
              <h3 className="text-sm font-semibold text-blue-400 uppercase tracking-wider mb-2">
                Improvement Suggestion
              </h3>
              <div className="bg-blue-900/20 border border-blue-800 p-4 rounded-lg text-blue-100 italic">
                "{analysis.better_answer}"
              </div>
            </div>

          </div>
        )}
        {/* <--- END REPORT CARD ---> */}

        {/* <--- NEW SECTION: HISTORY LIST ---> */}
        <div className="w-full max-w-2xl mt-12 mb-20">
          <h2 className="text-xl font-bold text-gray-400 mb-4 border-b border-gray-700 pb-2">
            Interview History
          </h2>

          <div className="space-y-4">
            {history.map((item) => (
              <div key={item.id} className="bg-gray-800 p-4 rounded-lg border border-gray-700 flex justify-between items-center hover:bg-gray-750 transition">

                {/* Left Side: Score & Date */}
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <span className={`font-bold px-2 py-0.5 rounded text-sm ${item.json_log.analysis.score >= 7 ? "bg-green-900 text-green-300" : "bg-red-900 text-red-300"
                      }`}>
                      Score: {item.json_log.analysis.score}
                    </span>
                    <span className="text-gray-500 text-xs">
                      {new Date(item.created_at).toLocaleString()}
                    </span>
                  </div>
                  {/* Show the first 50 chars of the transcript as a preview */}
                  <p className="text-gray-400 text-sm truncate w-64">
                    {item.json_log.transcript}
                  </p>
                </div>

                {/* Right Side: View Button (Optional for now) */}
                <button className="text-blue-400 hover:text-blue-300 text-sm font-medium">
                  View Full
                </button>
              </div>
            ))}

            {history.length === 0 && (
              <p className="text-gray-500 text-center italic">No history yet. Start speaking!</p>
            )}
          </div>
        </div>
        {/* <--- END HISTORY SECTION ---> */}
      </div>
    </div>
  );
}

export default App;