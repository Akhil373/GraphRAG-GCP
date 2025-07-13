import DOMPurify from 'dompurify';
import { marked } from 'marked';
import React, { useContext, useEffect, useRef } from 'react';
import SyntaxHighlighter from 'react-syntax-highlighter';
import { atomOneDark, docco } from 'react-syntax-highlighter/dist/esm/styles/hljs';
import { ThemeContext } from '../ThemeContext';

function ChatMessages({ 
  chatHistory, 
  isChatLoading,
  isFileDataLoading,
  selectedFile
}) {
  const chatEndRef = useRef(null);
  const { theme } = useContext(ThemeContext); // Get current theme
  
  // Choose syntax highlighting style based on theme
  const syntaxTheme = theme === 'dark' ? atomOneDark : docco;

  // Scroll to bottom whenever chat history changes
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, isChatLoading]);

  // Format message with code highlighting and structured AI output
  const formatMessage = (text) => {
    if (!text) return '';
    
    // Check if it's a structured AI response by looking for code block followed by [File] → [Entity] pattern
    const structuredResponseRegex = /```(\w+)?\s+([\s\S]+?)\s+```\s*\n\s*\[([^\]]+)\]\s*→\s*\[([^\]]+)\]/;
    const structuredMatch = text.match(structuredResponseRegex);
    
    if (structuredMatch) {
      // Extract parts of the structured response
      const language = structuredMatch[1] || '';
      const codeSnippet = structuredMatch[2];
      const fileName = structuredMatch[3];
      const entityName = structuredMatch[4];
      
      // Extract the sections (Purpose, Implementation, Relationships)
      const sectionsText = text.substring(structuredMatch[0].length);
      
      // Process the remaining content as regular markdown
      const processedSections = marked(sectionsText);
      
      return (
        <div className="structured-ai-response">
          {/* Code snippet with syntax highlighting */}
          <div className="code-snippet">
            <SyntaxHighlighter 
              language={language} 
              style={syntaxTheme}
              wrapLines={true}
              showLineNumbers={true}
            >
              {String(codeSnippet)}
            </SyntaxHighlighter>
          </div>
          
          {/* File and Entity reference */}
          <div className="entity-reference">
            <span className="file-name">{fileName}</span>
            <span className="arrow">→</span>
            <span className="entity-name">{entityName}</span>
          </div>
          
          {/* Sections with details */}
          <div 
            className="response-sections"
            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(processedSections) }}
          />
        </div>
      );
    }
    
    // Handle regular code blocks with SyntaxHighlighter for non-structured responses
    const codeBlockRegex = /```(\w+)?\n([\s\S]+?)\n```/g;
    let lastIndex = 0;
    const parts = [];
    let match;
    
    while ((match = codeBlockRegex.exec(text)) !== null) {
      // Add text before code block
      if (match.index > lastIndex) {
        const textBeforeCode = text.substring(lastIndex, match.index);
        parts.push(
          <div 
            key={`text-${lastIndex}`}
            dangerouslySetInnerHTML={{ 
              __html: DOMPurify.sanitize(marked(textBeforeCode)) 
            }}
          />
        );
      }
      
      // Add code block with syntax highlighting
      const language = match[1] || 'text';
      const code = match[2];
      parts.push(
        <div key={`code-${match.index}`} className="code-block-container">
          <SyntaxHighlighter 
            language={language} 
            style={syntaxTheme}
            wrapLines={true}
            showLineNumbers={true}
          >
            {String(code)}
          </SyntaxHighlighter>
        </div>
      );
      
      lastIndex = match.index + match[0].length;
    }
    
    // Add remaining text after last code block
    if (lastIndex < text.length) {
      const remainingText = text.substring(lastIndex);
      parts.push(
        <div 
          key={`text-${lastIndex}`}
          dangerouslySetInnerHTML={{ 
            __html: DOMPurify.sanitize(marked(remainingText)) 
          }}
        />
      );
    }
    
    return parts.length > 0 ? <div>{parts}</div> : (
      <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(marked(text)) }} />
    );
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (isFileDataLoading && selectedFile) {
    return (
      <div className="analyo-loading-container">
        <div className="analyo-spinner">
          <div className="bounce1"></div>
          <div className="bounce2"></div>
          <div className="bounce3"></div>
        </div>
        <p>Loading file data...</p>
      </div>
    );
  }

  return (
    <div className={`analyo-chat-messages ${theme}-theme`}>
      {chatHistory.length === 0 ? (
        <div className="analyo-empty-state">
          {selectedFile ? (
            selectedFile.isRepoContext ? (
              <>
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M2 17L12 22L22 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M2 12L12 17L22 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <h3>Ask about the repository</h3>
                <p>Chat with AI about the overall repository structure, code relationships, and architecture</p>
              </>
            ) : (
              <>
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M8 10H16M8 14H12M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <h3>Ask about this file</h3>
                <p>Chat with AI about the code structure, functions, and relationships in <strong>{selectedFile.path}</strong></p>
              </>
            )
          ) : (
            <>
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M7 14L5 12M5 12L7 10M5 12H15M13 18L15 20M15 20L17 18M15 20V12M9 6L7 4M7 4L5 6M7 4V12M19 14L21 12M21 12L19 10M21 12H11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <h3>Select a file or repo context to begin</h3>
              <p>Choose a file from the left panel or select "Repo Context" to chat about the entire codebase</p>
            </>
          )}
        </div>
      ) : (
        chatHistory.map((msg, index) => (
          <div 
            key={index} 
            className={`analyo-message ${msg.sender === 'user' ? 'user-message' : 'ai-message'}`}
          >
            <div className="message-header">
              <span className="message-sender">{msg.sender === 'user' ? 'You' : 'AI'}</span>
              <span className="message-time">
                {formatTime(msg.timestamp)}
              </span>
            </div>
            <div className="message-content">
              {typeof msg.text === 'string' ? formatMessage(msg.text) : msg.text}
            </div>
          </div>
        ))
      )}
      
      {isChatLoading && (
        <div className="analyo-message ai-message">
          <div className="message-header">
            <span className="message-sender">AI</span>
          </div>
          <div className="analyo-typing">
            <span></span>
            <span></span>
            <span></span>
            <span></span>
            <span></span>
          </div>
        </div>
      )}
      
      <div ref={chatEndRef} />
    </div>
  );
}

export default ChatMessages;
