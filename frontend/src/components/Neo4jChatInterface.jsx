import axios from 'axios';
import React, { useEffect, useState } from 'react';
import React, { useEffect, useState } from 'react';
import addNotification from 'react-push-notification';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import ChatMessages from './ChatMessages';
import FileList from './FileList';
import GraphControls from './GraphControls';
import GraphView from './GraphView';
import './Neo4jChatInterface.css';

const RAG_API_BASE_URL = 'https://ragapi-service-722252932298.us-central1.run.app';
const RAG_API_BASE_URL = 'https://ragapi-service-722252932298.us-central1.run.app';

function Neo4jChatInterface({ repoId, onBackToHome }) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [files, setFiles] = useState([]);
  const [fileData, setFileData] = useState(null);
  const [chatHistory, setChatHistory] = useState([]);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [isFilesLoading, setIsFilesLoading] = useState(false);
  const [isGraphLoading, setIsGraphLoading] = useState(false);
  const [isFileDataLoading, setIsFileDataLoading] = useState(false);
  const [chatQuery, setChatQuery] = useState('');
  const [graphData, setGraphData] = useState({ nodes: [], links: [] });
  const [graphFilters, setGraphFilters] = useState({
    nodeTypes: [],
    relationshipTypes: [],
    showAllNodeTypes: true,
    showAllRelationshipTypes: true,
  });
  const [isGraphViewOpen, setIsGraphViewOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Notify when file processing is complete
  const entryNotification = () => {
    addNotification({
      title: 'Completed processing files',
      message: 'Your files have been processed. You can now analyze your code.',
      duration: 10000,
      native: true
    });
  };
  
  // Fetch files when component mounts
  useEffect(() => {
    if (repoId) {
      fetchFiles();
      entryNotification();
    }

    // Also set up a listener for CORS/network errors
    const handleError = (event) => {
      if (event.message && event.message.includes("NetworkError")) {
        console.error("Network error detected:", event);
      }
    };
    
    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, [repoId]);

  // Fetch file list with fallback URLs
  const fetchFiles = async () => {
    setIsFilesLoading(true);
    try {
      // Use the correct base URL and path
      const response = await axios.get(`${RAG_API_BASE_URL}/api/graph/files?repo_id=${repoId}`);
      if (response.data.success) {
        setFiles(response.data.files);
      // Use the correct base URL and path
      const response = await axios.get(`${RAG_API_BASE_URL}/api/graph/files?repo_id=${repoId}`);
      if (response.data.success) {
        setFiles(response.data.files);
      }
    } catch (error) {
      // This console log will now only trigger if the corrected URL genuinely fails
      // This console log will now only trigger if the corrected URL genuinely fails
      console.error('Error fetching files:', error);
    } finally {
      setIsFilesLoading(false);
    }
  };

  // Handle file selection with fallback URLs
  const handleFileSelect = async (file) => {
    setSelectedFile(file);
    // Don't clear chat history when changing files
    // setChatHistory([]);
    
    // If we're selecting repo context, we don't need to fetch file data or graph
    if (file.isRepoContext) {
      setFileData(null);
      setIsGraphLoading(false);
      setIsFileDataLoading(false);
      
      // Set a generic graph data for visualization - just show repository nodes
      // This could be enhanced to show a high-level structure of the repo
      const repoGraphData = {
        nodes: [
          { 
            id: 'repo', 
            name: 'Repository',
            type: 'Repository',
            description: 'Repository root'
          }
        ],
        links: []
      };
      
      setGraphData(repoGraphData);
      
      // Set up filters for repo mode
      setGraphFilters({
        nodeTypes: ['Repository'],
        relationshipTypes: [],
        showAllNodeTypes: true,
        showAllRelationshipTypes: true,
        enabledNodeTypes: new Set(['Repository']),
        enabledRelationshipTypes: new Set()
      });
      
      return;
    }
    
    // For regular file selection, proceed with the normal flow
    setIsFileDataLoading(true);
    setIsGraphLoading(true);
    
    try {
      // Try first URL format for file data
      let response, graphResponse;
      
      try {
        response = await axios.get(`${RAG_API_BASE_URL}/api/graph/file-data?repo_id=${repoId}&file_path=${file.path}`);
        response = await axios.get(`${RAG_API_BASE_URL}/api/graph/file-data?repo_id=${repoId}&file_path=${file.path}`);
        if (response.data.success) {
          setFileData(response.data.fileData);
        }
      } catch (error) {
        console.log("First file-data URL format failed, trying alternative...");
        try {
          response = await axios.get(`${RAG_API_BASE_URL}/graph/file-data?repo_id=${repoId}&file_path=${file.path}`);
          response = await axios.get(`${RAG_API_BASE_URL}/graph/file-data?repo_id=${repoId}&file_path=${file.path}`);
          if (response.data.success) {
            setFileData(response.data.fileData);
          }
        } catch (innerError) {
          console.error('Error fetching file data with alternative URL:', innerError);
        }
      } finally {
        setIsFileDataLoading(false);
      }
      
      // Try first URL format for graph data
      try {
        graphResponse = await axios.get(`${RAG_API_BASE_URL}/api/graph/file-graph?repo_id=${repoId}&file_path=${file.path}`);
        graphResponse = await axios.get(`${RAG_API_BASE_URL}/api/graph/file-graph?repo_id=${repoId}&file_path=${file.path}`);
        if (graphResponse.data.success) {
          // Filter out isolated nodes (nodes without any connections)
          const connectedNodeIds = new Set();
          if (graphResponse.data.graphData.links) {
            graphResponse.data.graphData.links.forEach(link => {
              connectedNodeIds.add(link.source);
              connectedNodeIds.add(link.target);
            });
          }
          
          const filteredNodes = graphResponse.data.graphData.nodes
            ? graphResponse.data.graphData.nodes.filter(node => connectedNodeIds.has(node.id))
            : [];
            
          const filteredGraphData = {
            nodes: filteredNodes,
            links: graphResponse.data.graphData.links || []
          };
          
          setGraphData(filteredGraphData);
          processGraphData(filteredGraphData);
        }
      } catch (error) {
        console.log("First file-graph URL format failed, trying alternative...");
        try {
          graphResponse = await axios.get(`${RAG_API_BASE_URL}/graph/file-graph?repo_id=${repoId}&file_path=${file.path}`);
          graphResponse = await axios.get(`${RAG_API_BASE_URL}/graph/file-graph?repo_id=${repoId}&file_path=${file.path}`);
          if (graphResponse.data.success) {
            // Filter out isolated nodes (nodes without any connections)
            const connectedNodeIds = new Set();
            if (graphResponse.data.graphData.links) {
              graphResponse.data.graphData.links.forEach(link => {
                connectedNodeIds.add(link.source);
                connectedNodeIds.add(link.target);
              });
            }
            
            const filteredNodes = graphResponse.data.graphData.nodes
              ? graphResponse.data.graphData.nodes.filter(node => connectedNodeIds.has(node.id))
              : [];
              
            const filteredGraphData = {
              nodes: filteredNodes,
              links: graphResponse.data.graphData.links || []
            };
            
            setGraphData(filteredGraphData);
            processGraphData(filteredGraphData);
          }
        } catch (innerError) {
          console.error('Error fetching graph data with alternative URL:', innerError);
        }
      } finally {
        setIsGraphLoading(false);
      }
    } catch (error) {
      console.error('Error handling file selection:', error);
      setIsFileDataLoading(false);
      setIsGraphLoading(false);
    }
  };

  // Process graph data to extract filters
  const processGraphData = (data) => {
    if (data && data.nodes && data.links) {
      const nodeTypes = [...new Set(data.nodes.map(node => node.type))];
      const relationshipTypes = [...new Set(data.links.map(link => link.type))];
      
      setGraphFilters({
        nodeTypes,
        relationshipTypes,
        showAllNodeTypes: true,
        showAllRelationshipTypes: true,
        enabledNodeTypes: new Set(nodeTypes),
        enabledRelationshipTypes: new Set(relationshipTypes)
      });
    }
  };

  // Handle chat query submission
  const handleChatQuerySubmit = async (e) => {
    e.preventDefault();
    if (!chatQuery.trim() || !selectedFile) return;
    
    const userMessage = { sender: 'user', text: chatQuery, timestamp: new Date() };
    setChatHistory(prev => [...prev, userMessage]);
    setIsChatLoading(true);
    setChatQuery('');
    
    try {
      // Prepare request data based on whether we're in repo context or file context
      const requestData = {
        query: chatQuery,
        repo_id: repoId,
        history: chatHistory.slice(-5).map(msg => ({
          role: msg.sender === 'user' ? 'user' : 'assistant',
          content: msg.text
        }))
      };
      
      // If in repo context mode, don't include file_path and context
      if (selectedFile.isRepoContext) {
        // For repo context, we only need query and repo_id
        requestData.is_repo_context = true;
      } else {
        // For file context, include file path and context
        requestData.file_path = selectedFile.path;
        requestData.context = JSON.stringify(fileData);
      }
      
      const response = await axios.post(`${RAG_API_BASE_URL}/api/chat`, requestData);
      const response = await axios.post(`${RAG_API_BASE_URL}/api/chat`, requestData);
      
      if (response.data && response.data.response) {
        const aiMessage = { 
          sender: 'ai', 
          text: response.data.response,
          context_used: response.data.context_used || "",
          timestamp: new Date()
        };
        setChatHistory(prev => [...prev, aiMessage]);
        
        // If there's graph data, we can highlight the relevant nodes based on context
        if (response.data.context_used && graphData.nodes.length > 0) {
          highlightRelevantNodes(response.data.context_used);
        }
      } else {
        const errorMessage = { 
          sender: 'ai', 
          text: 'Sorry, I encountered an error processing your request. Please try again.',
          timestamp: new Date()
        };
        setChatHistory(prev => [...prev, errorMessage]);
      }
    } catch (error) {
      console.error('Error sending chat query:', error);
      const errorMessage = { 
        sender: 'ai', 
        text: `Error: ${error.message}. Please try again.`,
        timestamp: new Date() 
      };
      setChatHistory(prev => [...prev, errorMessage]);
    } finally {
      setIsChatLoading(false);
    }
  };
  
  // Function to highlight nodes mentioned in the context
  const highlightRelevantNodes = (context) => {
    if (!context || !graphData.nodes.length) return;
    
    // Extract function and file names from context
    const functionNameRegex = /function called '([^']+)'/g;
    const filePathRegex = /file '([^']+)'/g;
    const classRegex = /class called '([^']+)'/g;
    
    const relevantNames = new Set();
    let match;
    
    // Extract function names
    while ((match = functionNameRegex.exec(context)) !== null) {
      relevantNames.add(match[1]);
    }
    
    // Extract class names
    while ((match = classRegex.exec(context)) !== null) {
      relevantNames.add(match[1]);
    }
    
    // Extract file names (just the basename)
    while ((match = filePathRegex.exec(context)) !== null) {
      const fullPath = match[1];
      const basename = fullPath.split('/').pop();
      if (basename) relevantNames.add(basename);
    }
    
    // No relevant names found
    if (relevantNames.size === 0) return;
    
    // Create a custom event to highlight nodes in the graph
    window.dispatchEvent(new CustomEvent('highlight-nodes', { 
      detail: { 
        nodeNames: Array.from(relevantNames)
      }
    }));
  };

  // Handle graph filter changes
  const handleGraphFilterChange = (filterType, filterValue, isEnabled) => {
    setGraphFilters(prevFilters => {
      const newFilters = { ...prevFilters };
      
      if (filterType === 'nodeType') {
        const newEnabledNodeTypes = new Set(newFilters.enabledNodeTypes);
        
        if (isEnabled) {
          newEnabledNodeTypes.add(filterValue);
        } else {
          newEnabledNodeTypes.delete(filterValue);
        }
        
        newFilters.enabledNodeTypes = newEnabledNodeTypes;
        newFilters.showAllNodeTypes = newEnabledNodeTypes.size === newFilters.nodeTypes.length;
      } 
      else if (filterType === 'relationshipType') {
        const newEnabledRelationshipTypes = new Set(newFilters.enabledRelationshipTypes);
        
        if (isEnabled) {
          newEnabledRelationshipTypes.add(filterValue);
        } else {
          newEnabledRelationshipTypes.delete(filterValue);
        }
        
        newFilters.enabledRelationshipTypes = newEnabledRelationshipTypes;
        newFilters.showAllRelationshipTypes = newEnabledRelationshipTypes.size === newFilters.relationshipTypes.length;
      }
      else if (filterType === 'toggleAllNodeTypes') {
        newFilters.showAllNodeTypes = isEnabled;
        newFilters.enabledNodeTypes = isEnabled 
          ? new Set(newFilters.nodeTypes) 
          : new Set();
      }
      else if (filterType === 'toggleAllRelationshipTypes') {
        newFilters.showAllRelationshipTypes = isEnabled;
        newFilters.enabledRelationshipTypes = isEnabled 
          ? new Set(newFilters.relationshipTypes) 
          : new Set();
      }
      
      return newFilters;
    });
  };

  // Filter graph data based on current filters
  const filteredGraphData = React.useMemo(() => {
    if (!graphFilters.enabledNodeTypes || !graphFilters.enabledRelationshipTypes) {
      return graphData;
    }
    
    const filteredNodes = graphData.nodes.filter(node => 
      graphFilters.enabledNodeTypes.has(node.type)
    );
    
    const filteredNodeIds = new Set(filteredNodes.map(node => node.id));
    
    const filteredLinks = graphData.links.filter(link => 
      graphFilters.enabledRelationshipTypes.has(link.type) &&
      filteredNodeIds.has(link.source.id || link.source) &&
      filteredNodeIds.has(link.target.id || link.target)
    );
    
    // Create a new object to ensure React detects the change
    return {
      nodes: [...filteredNodes],
      links: [...filteredLinks].map(link => {
        // Ensure links have proper references to node objects, not just IDs
        // This is crucial for the force graph to work properly
        if (typeof link.source === 'string' || typeof link.source === 'number') {
          const sourceNode = filteredNodes.find(node => node.id === link.source);
          const targetNode = filteredNodes.find(node => node.id === link.target);
          if (sourceNode && targetNode) {
            return {
              ...link,
              source: sourceNode,
              target: targetNode
            };
          }
        }
        return link;
      })
    };
  }, [graphData, graphFilters]);

  // Handle starting a new session
  const handleStartNew = () => {
    if (onBackToHome) {
      onBackToHome();
    } else {
      // Fallback if no callback provided
      setChatHistory([]);
      setSelectedFile(null);
      setFileData(null);
      setGraphData({ nodes: [], links: [] });
      setChatQuery('');
      setIsGraphViewOpen(false);
    }
  };

  // Filter files based on search term
  const filteredFiles = searchTerm
    ? files.filter(file => 
        file.path.toLowerCase().includes(searchTerm.toLowerCase()) ||
        file.name.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : files;

  return (
    <div className="analyo-interface">
      {/* Left Sidebar */}
      <aside className="left-sidebar">
        <div className="sidebar-header">
          <h1 className="app-name">Analyo</h1>
          <button 
            className="start-new-btn"
            onClick={handleStartNew}
            title="Start with New Repository"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M3 12h18m-9-9l9 9-9 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Start with New Repo
          </button>
        </div>

        <div className="sidebar-search">
          <div className="search-container">
            <svg className="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2"/>
              <path d="m21 21-4.35-4.35" stroke="currentColor" strokeWidth="2"/>
            </svg>
            <input
              type="text"
              className="search-input"
              placeholder="Search files..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="file-tree">
          <div className="file-tree-header">
            <span>Repository Files</span>
            {isFilesLoading && <div className="loading-spinner"></div>}
          </div>
          <div className="file-tree-content">
            <FileList
              files={filteredFiles}
              selectedFile={selectedFile}
              onFileSelect={handleFileSelect}
              isLoading={isFilesLoading}
            />
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="main-content">
        <div className="chat-container">
          {/* View Graph Button */}
          <button 
            className={`view-graph-btn ${isGraphViewOpen ? 'active' : ''}`}
            onClick={() => setIsGraphViewOpen(!isGraphViewOpen)}
            title={isGraphViewOpen ? "Hide Graph" : "View Graph"}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2"/>
              <circle cx="12" cy="3" r="1" stroke="currentColor" strokeWidth="2"/>
              <circle cx="21" cy="12" r="1" stroke="currentColor" strokeWidth="2"/>
              <circle cx="12" cy="21" r="1" stroke="currentColor" strokeWidth="2"/>
              <circle cx="3" cy="12" r="1" stroke="currentColor" strokeWidth="2"/>
              <path d="m9.88 9.88 4.24 4.24" stroke="currentColor" strokeWidth="2"/>
              <path d="m9.88 14.12 4.24-4.24" stroke="currentColor" strokeWidth="2"/>
            </svg>
            {isGraphViewOpen ? 'Hide Graph' : 'View Graph'}
          </button>

          {/* Chat Messages Area */}
          <div className="chat-messages">
            {!selectedFile ? (
              <div className="welcome-message">
                <div className="welcome-icon">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M14 2V8H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <h2>Ask about this file</h2>
                <p>Select a file from the sidebar to start analyzing your code with AI assistance.</p>
              </div>
            ) : (
              <div className="chat-content">
                <div className="file-header">
                  <div className="file-info">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M14 2V8H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <span className="file-path">{selectedFile.path}</span>
                  </div>
                </div>
                
                <div className="messages-list">
                  <ChatMessages
                    chatHistory={chatHistory}
                    isChatLoading={isChatLoading}
                    selectedFile={selectedFile}
                    isFileDataLoading={isFileDataLoading}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Chat Input - Always at bottom */}
          <div className="chat-input-section">
            <form onSubmit={handleChatQuerySubmit} className="chat-input-form">
              <div className="input-container">
                <textarea
                  className="chat-textarea"
                  value={chatQuery}
                  onChange={(e) => setChatQuery(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleChatQuerySubmit(e);
                    }
                  }}
                  placeholder={selectedFile 
                    ? selectedFile.isRepoContext
                      ? "Ask about the repository's code structure, architecture, and relationships..."
                      : `Ask about ${selectedFile.name}...` 
                    : "Select a file to start chatting..."
                  }
                  disabled={isChatLoading || !selectedFile || isFileDataLoading}
                  rows={1}
                />
                <button 
                  type="submit" 
                  className="send-button"
                  disabled={isChatLoading || !chatQuery.trim() || !selectedFile || isFileDataLoading}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M22 2L11 13M22 2L15 22L11 13M22 2L2 9L11 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              </div>
            </form>
          </div>
        </div>
      </main>

      {/* Toggleable Graph View */}
      {isGraphViewOpen && (
        <div className="graph-overlay">
          <div className="graph-panel">
            <div className="graph-header">
              <h3>Code Graph Visualization</h3>
              <button 
                className="close-graph-btn"
                onClick={() => setIsGraphViewOpen(false)}
                title="Close Graph View"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>
            <div className="graph-content">
              <div className="graph-controls-section">
                <GraphControls
                  filters={graphFilters}
                  onFilterChange={handleGraphFilterChange}
                />
              </div>
              <div className="graph-view-section">
                <GraphView
                  graphData={filteredGraphData}
                  selectedFile={selectedFile}
                  isLoading={isGraphLoading}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Neo4jChatInterface;