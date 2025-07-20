import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Bot, Paperclip, Send, X, Delete, Trash } from 'lucide-react';
import { OllamaChat } from './server/ollama.model.js';
import ChatMessage from './components/Chat.jsx';


export default function App() {

  const ollamaChat = useMemo(() => new OllamaChat(), []);
  const [model, setModel] = useState('');
  const [allModels, setAllModels] = useState([]);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [pullModelName, setPullModelName] = useState('');
  const [pullStatus, setPullStatus] = useState('');

  const chatContainerRef = useRef(null);
  const fileInputRef = useRef(null);

  const [showModelPopup, setShowModelPopup] = useState(false);


  // Load models on initial render
  const fetchModels = async () => {
    try {
      const models = await ollamaChat.loadModels();
      setAllModels(models);
      if (models.length > 0 && !model) {
        setModel(models[0].name);
      }
    } catch (error) {
      console.error('Failed to load models:', error);
      setPullStatus(`Error: Failed to connect to Ollama. Ensure it's running.`);
    }
  };

  useEffect(() => {
    fetchModels();
  }, [ollamaChat]);

  // Scroll to bottom of chat
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages, isStreaming]);

  const handleSendMessage = async () => {
    if (isStreaming || (!inputMessage.trim() && !selectedFile)) return;
    if (!model) {
      setPullStatus("Error: Please select a model first.");
      return;
    }

    setIsStreaming(true);

    const userMessage = {
      role: 'user',
      content: inputMessage,
      fileInfo: selectedFile ? {
        name: selectedFile.name,
        type: selectedFile.type,
        url: URL.createObjectURL(selectedFile),
      } : undefined,
    };
    setMessages(prev => [...prev, userMessage]);

    ollamaChat.setFile(selectedFile);
    setInputMessage('');
    setSelectedFile(null);

    try {
      const stream = await ollamaChat.sendMessage({ text: inputMessage, model });
      const reader = stream.getReader();

      setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

      while (true) {
        const { value, done } = await reader.read();
        if (done) {
          setIsStreaming(false);
          break;
        }

        if (value.type === 'update') {
          setMessages(prev => {
            const newMessages = [...prev];
            const lastMessage = newMessages[newMessages.length - 1];
            if (lastMessage && lastMessage.role === 'assistant') {
              // *** THE FIX IS HERE ***
              // Append the new chunk to the existing content instead of replacing it.
              lastMessage.content += value.content;
            }
            return newMessages;
          });
        }

        if (value.type === 'done') {
          setMessages(prev => {
            const newMessages = [...prev];
            const lastMessage = newMessages[newMessages.length - 1];
            if (lastMessage && lastMessage.role === 'assistant') {
              lastMessage.content = value.message.content;
            }
            return newMessages;
          });
        }
      }

    } catch (error) {
      console.error('Streaming failed:', error);
      setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${error.message}` }]);
      setIsStreaming(false);
    }
  };

  const handlePullModel = async () => {
    if (!pullModelName.trim()) return;
    setPullStatus(`Pulling model: ${pullModelName}...`);
    try {
      await ollamaChat.pullModel(pullModelName, (progress) => {
        let status = progress.status;
        if (progress.total && progress.completed) {
          const percent = Math.round((progress.completed / progress.total) * 100);
          status += ` ${percent}%`;
        }
        setPullStatus(status);
      });
      setPullStatus(`Successfully pulled ${pullModelName}`);
      setPullModelName('');
      fetchModels();
    } catch (error) {
      console.error('Failed to pull model:', error);
      setPullStatus(`Error pulling model: ${error.message}`);
    }
  };

  const handleClearChat = () => {
    ollamaChat.clearChat();
    setMessages([]);
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleDeleteModel = async(modelName) => {
    if (!confirm(`Are you sure you want to delete "${modelName}"?`)) return;
    await ollamaChat.deleteModel(modelName);
    setAllModels(prev => prev.filter(m => m.name !== modelName));
    if (model === modelName) {
      setModel('');
      setMessages([]);
    }
    setPullStatus(`Deleted model: ${modelName}`);
    if (allModels.length === 1) {
      setModel(allModels[0].name);
    }
  }

  return (
    <div className="w-full h-screen bg-slate-50 text-slate-800 flex flex-col font-sans">
      {/* Header */}
      <header className="w-full bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-6 flex flex-col gap-6 md:gap-4">
          {/* Title + Subtitle */}
          <div className="text-center w-full flex-col items-center justify-center">
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
              Ollama Web Chat
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Advanced AI Chat with Streaming & File Support
            </p>
          </div>

          {/* Controls */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            {/* Pull Model */}
            <div className="flex flex-wrap gap-2 items-center">
              <input
                type="text"
                value={pullModelName}
                onChange={(e) => setPullModelName(e.target.value)}
                placeholder="e.g., llama3"
                className="px-3 py-2 border border-slate-300 rounded-md text-sm w-40 bg-white text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
              <button
                onClick={handlePullModel}
                className="px-4 py-2 cursor-pointer bg-white border border-slate-300 text-slate-700 rounded-md text-sm hover:bg-slate-100 transition"
              >
                Pull Model
              </button>
            </div>

            {/* Model Select + Clear */}
            <div className="flex flex-wrap gap-2 items-center">
              <button
                onClick={() => setShowModelPopup(true)}
                className="px-4 py-2  text-neutral-800 cursor-pointer border border-gray-300 rounded-md text-sm transition"
              >
                {model ? `${model}` : 'Select Model'}
              </button>
              <button
                onClick={handleClearChat}
                className="px-4 py-2 bg-rose-600 cursor-pointer text-white rounded-md text-sm hover:bg-rose-700 transition"
              >
                Clear Chat
              </button>
            </div>


          </div>

          {/* Pull Status */}
          {pullStatus && (
            <div className="text-center">
              <p className="text-sm text-slate-500 animate-fade-in">{pullStatus}</p>
            </div>
          )}
        </div>
      </header>

      {/* Chat Area */}
      <main ref={chatContainerRef} className="flex-grow p-4 overflow-y-auto bg-slate-50">
        <div className="max-w-5xl mx-auto">
          {messages.length === 0 ? (
            <div className="text-center text-slate-400 mt-20 p-8">
              <Bot size={48} className="mx-auto text-blue-500" />
              <h2 className="text-xl font-semibold mt-4 text-slate-700">Welcome!</h2>
              <p>Select a model from the top right and start chatting.</p>
            </div>
          ) : (
            messages.map((msg, index) => <ChatMessage key={index} message={msg} />)
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="flex-shrink-0 bg-white border-t border-slate-200 p-4">
        <div className="max-w-5xl mx-auto">
          {/* File Preview */}
          {selectedFile && (
            <div className="flex items-center justify-between bg-slate-100 border border-slate-200 rounded-md px-3 py-2 mb-3 text-sm shadow-sm animate-fade-in">
              <div className="flex items-center gap-2">
                <Paperclip className="w-4 h-4 text-slate-500" />
                <span className="text-slate-700 font-medium truncate max-w-[200px]">{selectedFile.name}</span>
              </div>
              <button
                onClick={() => setSelectedFile(null)}
                className="p-1 rounded-full hover:bg-slate-200 transition"
                aria-label="Remove file"
              >
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>
          )}

          {/* Input Area */}
          <div className="flex items-end gap-3 md:gap-4">
            {/* File Upload Button */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              className="hidden"
              accept="image/*"
            />
            <button
              onClick={() => fileInputRef.current.click()}
              className="p-2 rounded-full bg-slate-100 hover:bg-slate-200 transition"
              aria-label="Attach file"
            >
              <Paperclip className="w-5 h-5 text-slate-500" />
            </button>

            {/* Text Input */}
            <div className="flex-1 relative">
              <textarea
                rows="1"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={(e) =>
                  e.key === 'Enter' && !e.shiftKey
                    ? (e.preventDefault(), handleSendMessage())
                    : null
                }
                placeholder="Type a message or attach a file..."
                className="w-full p-3 border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none text-sm transition"
                disabled={isStreaming}
                style={{ maxHeight: '120px' }}
              />
            </div>

            {/* Send Button */}
            <button
              onClick={handleSendMessage}
              disabled={isStreaming || (!inputMessage.trim() && !selectedFile)}
              className={`p-3 rounded-lg flex items-center justify-center transition-colors ${isStreaming || (!inputMessage.trim() && !selectedFile)
                ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              aria-label="Send message"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </div>
      </footer>
      {showModelPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="bg-white rounded-lg shadow-lg p-6 w-[90%] max-w-md">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Available Models</h2>
            <div className="max-h-64 overflow-y-auto flex flex-col gap-2">
              {allModels.map((m) => (
                <div
                  key={m.name}
                  className="flex justify-between items-center rounded gap-2 px-3 py-2"
                >
                  <div className="text-sm w-full text-gray-800 border border-gray-200 rounded-md p-2 cursor-pointer hover:text-blue-600"
                    onClick={() => {
                      setModel(m.name);
                      setShowModelPopup(false);
                    }}>{m.name}</div>
                  <button
                    onClick={() => handleDeleteModel(m.name)}
                    className="text-sm text-rose-600 hover:text-rose-700 cursor-pointer font-medium"
                  >
                    <Trash />
                  </button>
                </div>
              ))}
            </div>
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowModelPopup(false)}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

