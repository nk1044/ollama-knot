import React from 'react';
import { User, Bot } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

const ChatMessage = ({ message }) => {
  const { role, content, fileInfo } = message;
  const isUser = role === 'user';

  // The component is designed to handle streaming content.
  // As the `content` prop updates with new chunks from the API,
  // ReactMarkdown will re-render the content, correctly parsing
  // markdown as it becomes complete.

  return (
    <div className={`flex items-start gap-3 md:gap-4 my-6 ${isUser ? 'flex-row-reverse' : ''}`}>
      {/* Icon */}
      <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${isUser ? 'bg-blue-600' : 'bg-slate-200'}`}>
        {isUser ? (
          <User className="w-6 h-6 text-white" />
        ) : (
          <Bot className="w-6 h-6 text-slate-600" />
        )}
      </div>

      {/* Message Bubble */}
      <div 
        className={`p-4 rounded-lg max-w-2xl w-fit shadow-sm ${isUser ? 'bg-blue-600 text-white' : 'bg-white text-slate-800 border border-slate-200'}`}
      >
        {/* Attached Image Preview */}
        {fileInfo && fileInfo.type.startsWith('image/') && (
          <img 
            src={fileInfo.url} 
            alt={fileInfo.name} 
            className="max-w-xs h-auto rounded-lg mb-2 border border-slate-200" 
            // Updated placeholder for a light theme
            onError={(e) => { e.target.onerror = null; e.target.src='https://placehold.co/400x300/f1f5f9/1e293b?text=Image+Load+Failed'; }}
          />
        )}
        
        {/* Markdown Content */}
        <div className="prose prose-sm prose-slate max-w-none text-inherit">
            <ReactMarkdown
              components={{
                // This custom component renders code blocks with syntax highlighting
                code({ node, inline, className, children, ...props }) {
                  const match = /language-(\w+)/.exec(className || '');
                  return !inline && match ? (
                    <SyntaxHighlighter
                      style={vscDarkPlus} // A dark style provides great contrast
                      language={match[1]}
                      PreTag="div"
                      {...props}
                    >
                      {String(children).replace(/\n$/, '')}
                    </SyntaxHighlighter>
                  ) : (
                    // This handles inline code snippets
                    <code className="bg-slate-100 text-slate-700 rounded-md px-1.5 py-1 text-xs font-mono" {...props}>
                      {children}
                    </code>
                  );
                },
              }}
            >
              {content}
            </ReactMarkdown>
        </div>
      </div>
    </div>
  );
};

export default ChatMessage;