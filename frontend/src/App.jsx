import axios from 'axios';
import { useContext, useEffect, useRef, useState } from 'react';
import './App.css';
import { ThemeContext } from './ThemeContext';
import Neo4jChatInterface from './components/Neo4jChatInterface';
import ThemeToggle from './components/ThemeToggle';

const webname = "Analyo";

const API_STATUS = {
  IDLE: 'idle',
  FETCHING: 'fetching',
  PROCESSING: 'processing',
  READY: 'ready',
  ERROR: 'error',
};

function App() {
  const { theme } = useContext(ThemeContext);
  const [githubUrl, setGithubUrl] = useState('');
  const [uiState, setUiState] = useState('welcome'); // welcome, loading, file-selection, chat
  const [statusMessage, setStatusMessage] = useState('');
  const [apiState, setApiState] = useState(API_STATUS.IDLE);
  
  // State for file selection
  const [files, setFiles] = useState([]);
  const [selectedFiles, setSelectedFiles] = useState(new Set());
  const [repoId, setRepoId] = useState(null);

  // State for file viewer modal
  const [fileViewerOpen, setFileViewerOpen] = useState(false);
  const [viewingFile, setViewingFile] = useState({ path: '', content: '' });
  const [isLoadingFileContent, setIsLoadingFileContent] = useState(false);

  const [chatQuery, setChatQuery] = useState('');
  const [chatHistory, setChatHistory] = useState([]);
  const chatEndRef = useRef(null);
  const [fileSearchTerm, setFileSearchTerm] = useState('');
  const [isHeaderVisible, setIsHeaderVisible] = useState(true);
  const prevScrollPos = useRef(0);
  
  // State for the confirmation dialog
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  const [processingProgress, setProcessingProgress] = useState({
    total: 0,
    processed: 0,
    percentage: 0,
    currentFile: ''
  });

  const BACKEND_BASE_URL = 'https://main-service-722252932298.us-central1.run.app/api';
  const RAG_API_URL = 'https://ragapi-service-722252932298.us-central1.run.app/api/chat';
  const CLEAR_DB_URL = 'https://ragapi-service-722252932298.us-central1.run.app/api/clear-database';

  // State for expanded folders in the file browser
  const [expandedFolders, setExpandedFolders] = useState(new Set());

  // Add this function to toggle folder expansion
  const toggleFolder = (folderPath) => {
    setExpandedFolders(prev => {
      const newSet = new Set(prev);
      if (newSet.has(folderPath)) {
        newSet.delete(folderPath);
      } else {
        newSet.add(folderPath);
      }
      return newSet;
    });
  };

  // Scroll to bottom whenever chat history changes
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

  // Handle scroll in chat history to hide/show header
  useEffect(() => {
    const handleScroll = (e) => {
      if (!e.target.classList.contains('chat-history')) return;
      
      const currentScrollPos = e.target.scrollTop;
      const isScrollingDown = currentScrollPos > prevScrollPos.current && currentScrollPos > 50;
      
      if (isScrollingDown !== !isHeaderVisible) {
        setIsHeaderVisible(!isScrollingDown);
      }
      
      prevScrollPos.current = currentScrollPos;
    };
    
    const chatHistory = document.querySelector('.chat-history');
    if (chatHistory) {
      chatHistory.addEventListener('scroll', handleScroll);
    }
    
    return () => {
      const chatHistory = document.querySelector('.chat-history');
      if (chatHistory) {
        chatHistory.removeEventListener('scroll', handleScroll);
      }
    };
  }, [isHeaderVisible]);

  // Handle the "Start New" button click
  const handleStartNewClick = () => {
    setShowConfirmDialog(true);
  };

  // Handle confirmation dialog confirmation
  const handleConfirmStartNew = async () => {
    setIsClearing(true);
    try {
      // Make API call to clear database
      await axios.post(CLEAR_DB_URL);
      
      // Reset all state
      setGithubUrl('');
      setUiState('welcome');
      setStatusMessage('');
      setApiState(API_STATUS.IDLE);
      setFiles([]);
      setSelectedFiles(new Set());
      setRepoId(null);
      setChatHistory([]);
      setChatQuery('');
      setProcessingProgress({
        total: 0,
        processed: 0,
        percentage: 0,
        currentFile: ''
      });
      console.log("Application state reset successfully");
    } catch (error) {
      console.error('Error clearing database:', error);
      setChatHistory(prev => [...prev, { 
        sender: 'ai', 
        text: `Error clearing database: ${error.message}. Please try again.` 
      }]);
    } finally {
      setShowConfirmDialog(false);
      setIsClearing(false);
    }
  };

  // Handle confirmation dialog cancellation
  const handleCancelStartNew = () => {
    setShowConfirmDialog(false);
  };

  // Handle navigation back to home - Clear entire repository state
  const handleBackToHome = async () => {
    try {
      // Clear backend database first
      await axios.post(CLEAR_DB_URL);
      
      // Reset UI state
      setUiState('welcome');
      setApiState(API_STATUS.IDLE);
      setStatusMessage('');
      
      // Clear repository data
      setRepoId('');
      setGithubUrl('');
      setFiles([]);
      setSelectedFiles(new Set());
      setExpandedFolders(new Set());
      
      // Clear chat and search state
      setChatHistory([]);
      setChatQuery('');
      setFileSearchTerm('');
      setIsChatLoading(false);
      
      // Clear file viewer state
      setFileViewerOpen(false);
      setViewingFile({ path: '', content: '' });
      setIsLoadingFileContent(false);
      
      // Clear dialog states
      setShowConfirmDialog(false);
      setIsClearing(false);
      
      // Reset processing progress
      setProcessingProgress({
        total: 0,
        processed: 0,
        percentage: 0,
        currentFile: ''
      });
      
      // Reset header visibility
      setIsHeaderVisible(true);
      
      console.log("Application and database cleared successfully");
    } catch (error) {
      console.error('Error clearing database during home navigation:', error);
      // Still reset the UI state even if database clearing fails
      setUiState('welcome');
      setApiState(API_STATUS.IDLE);
      setStatusMessage('');
      setRepoId('');
      setGithubUrl('');
      setFiles([]);
      setSelectedFiles(new Set());
      setExpandedFolders(new Set());
      setChatHistory([]);
      setChatQuery('');
      setFileSearchTerm('');
      setIsChatLoading(false);
      setFileViewerOpen(false);
      setViewingFile({ path: '', content: '' });
      setIsLoadingFileContent(false);
      setShowConfirmDialog(false);
      setIsClearing(false);
      setProcessingProgress({
        total: 0,
        processed: 0,
        percentage: 0,
        currentFile: ''
      });
      setIsHeaderVisible(true);
    }
  };

  const handleSubmitRepo = async (e) => {
    e.preventDefault();
    if (!githubUrl.trim()) return;

    setUiState('loading');
    setApiState(API_STATUS.FETCHING);
    setStatusMessage('Fetching repository files...');
    setChatHistory([]);
    setFiles([]);
    setSelectedFiles(new Set());

    try {
      const fetchResponse = await axios.post(`${BACKEND_BASE_URL}/fetch-repo-files`, {
        github_url: githubUrl,
      });

      if (!fetchResponse.data.success) {
        throw new Error(fetchResponse.data.message || 'Failed to fetch files.');
      }
      
      setFiles(fetchResponse.data.files);
      setRepoId(fetchResponse.data.repo_id);
      setStatusMessage('Please select files to process.');
      setApiState(API_STATUS.IDLE);
      setUiState('file-selection');

    } catch (error) {
      console.error('Error fetching repository:', error);
      setStatusMessage(`Error: ${error.message}`);
      setApiState(API_STATUS.ERROR);
      setUiState('welcome'); // Revert to welcome on error
    }
  };

  const handleFileSelect = (filePath) => {
    const newSelectedFiles = new Set(selectedFiles);
    if (newSelectedFiles.has(filePath)) {
      newSelectedFiles.delete(filePath);
    } else {
      newSelectedFiles.add(filePath);
    }
    setSelectedFiles(newSelectedFiles);
  };

  const handleSelectAll = () => {
    if (selectedFiles.size === filteredFiles.length) {
      setSelectedFiles(new Set()); // Deselect all
    } else {
      setSelectedFiles(new Set(filteredFiles)); // Select all filtered files
    }
  };
  
  const handleProcessSelectedFiles = async () => {
    if (selectedFiles.size === 0) {
      setStatusMessage('Please select at least one file.');
      return;
    }

    setUiState('loading');
    setApiState(API_STATUS.PROCESSING);
    setStatusMessage(`Processing ${selectedFiles.size} selected files...`);
    
    // Initialize progress with known values
    setProcessingProgress({
      total: selectedFiles.size,
      processed: 0,
      percentage: 0,
      currentFile: ''
    });

    try {
      const processResponse = await axios.post(`${BACKEND_BASE_URL}/process-files`, {
        selected_files: Array.from(selectedFiles),
        repo_id: repoId,
      });

      if (!processResponse.data.success) {
        throw new Error(processResponse.data.message || 'Failed to process files.');
      }

      // Start polling for status
      pollProcessingStatus(repoId);

    } catch (error) {
      console.error('Error processing files:', error);
      setStatusMessage(`Error: ${error.message}`);
      setApiState(API_STATUS.ERROR);
      setUiState('file-selection'); // Go back to selection on error
    }
  };

  // New function to poll processing status
  const pollProcessingStatus = async (repoId) => {
    if (!repoId) return;
    
    // Use a variable to track if we should continue polling
    let continuePolling = true;
    let pollCount = 0;
    const MAX_POLLS = 120; // Maximum number of polls (10 minutes at 5s intervals)
    
    while (continuePolling && pollCount < MAX_POLLS) {
      try {
        // Poll the status endpoint
        const statusResponse = await axios.get(`${BACKEND_BASE_URL}/processing-status?repo_id=${repoId}`);
        
        if (statusResponse.data.success) {
          // Extract the relevant data from the response
          const { status, message, is_complete, files_processed, total_files, partial_success } = statusResponse.data;
          
          // Update progress state
          const percentage = total_files > 0 
            ? Math.round((files_processed / total_files) * 100) 
            : 0;
            
          setProcessingProgress({
            total: total_files || 0,
            processed: files_processed || 0,
            percentage: percentage,
            currentFile: statusResponse.data.current_file || ''
          });
          
          // Update UI with current status
          setStatusMessage(`${message} (${files_processed || 0}/${total_files || 0})`);
          
          // Check if processing is complete, partial success, or had an error
          if (is_complete === true) {
            // Set progress to 100% when complete
            setProcessingProgress(prev => ({
              ...prev, 
              percentage: 100,
              processed: prev.total
            }));
            
            setApiState(API_STATUS.READY);
            
            // Customize message based on complete vs partial
            if (partial_success) {
              setStatusMessage(`Partial processing complete. ${files_processed}/${total_files} files analyzed.`);
              
              // If there are failed files, add them to the message
              if (statusResponse.data.failed_files && statusResponse.data.failed_files.length > 0) {
                console.log("Failed files:", statusResponse.data.failed_files);
              }
            } else {
              setStatusMessage(`Processing complete! ${total_files} files analyzed.`);
            }
            
            // Go directly to the Neo4j chat interface
            setUiState('chat');
            continuePolling = false;
          } else if (status === 'error') {
            setApiState(API_STATUS.ERROR);
            setStatusMessage(`Error: ${message}`);
            continuePolling = false;
          }
        }
      } catch (error) {
        console.error('Error polling status:', error);
        // Don't stop polling on error, just continue
      }
      
      // Increment poll count
      pollCount++;
      
      // Wait 5 seconds before next poll if we're still polling
      if (continuePolling) {
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
    
    // If we reached max polls without completing
    if (pollCount >= MAX_POLLS && continuePolling) {
      setApiState(API_STATUS.ERROR);
      setStatusMessage('Processing timed out. Please try again or with fewer files.');
      setUiState('file-selection');
    }
  };

  // Filter files based on search term
  const filteredFiles = fileSearchTerm
    ? files.filter(file => file.toLowerCase().includes(fileSearchTerm.toLowerCase()))
    : files;
  
  // Helper function to get folder structure from file paths
  const getFolderStructure = (files) => {
    const structure = {};
    
    files.forEach(file => {
      const parts = file.split('/');
      let current = structure;
      
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        
        if (i === parts.length - 1) {
          // It's a file
          current[part] = file;
        } else {
          // It's a directory
          if (!current[part]) {
            current[part] = {};
          }
          current = current[part];
        }
      }
    });
    
    return structure;
  };
  
  // Count files in a folder structure
  const countFilesInFolder = (obj) => {
    return Object.entries(obj).reduce((count, [_, val]) => {
      if (typeof val === 'string') {
        return count + 1;
      } else {
        return count + countFilesInFolder(val);
      }
    }, 0);
  };
  
  // Get all file paths in a folder structure
  const getFilePaths = (obj, result = []) => {
    Object.entries(obj).forEach(([_, val]) => {
      if (typeof val === 'string') {
        result.push(val);
      } else {
        getFilePaths(val, result);
      }
    });
    return result;
  };

  // Function to fetch file contents
  const handleViewFile = async (filePath, e) => {
    e.stopPropagation(); // Prevent file selection when clicking view button
    
    setViewingFile({ path: filePath, content: '' });
    setIsLoadingFileContent(true);
    setFileViewerOpen(true);
    
    try {
      const response = await axios.post(`${BACKEND_BASE_URL}/get-file-content`, {
        repo_id: repoId,
        file_path: filePath
      });
      
      if (response.data.success) {
        setViewingFile({
          path: filePath,
          content: response.data.content
        });
      } else {
        setViewingFile({
          path: filePath,
          content: 'Error: Could not load file content.'
        });
      }
    } catch (error) {
      console.error('Error fetching file content:', error);
      setViewingFile({
        path: filePath,
        content: `Error: ${error.message || 'Failed to load file content.'}`
      });
    } finally {
      setIsLoadingFileContent(false);
    }
  };
  
  const closeFileViewer = () => {
    setFileViewerOpen(false);
    setViewingFile({ path: '', content: '' });
  };

  // Helper function to render folder structure recursively
  const renderFolderTree = (structure, expandedFolders, toggleFolder, path = "", indent = 0) => {
    return Object.entries(structure).map(([key, value]) => {
      if (typeof value === 'string') {
        // It's a file
        return (
          <li key={value} 
            className={`file-item ${selectedFiles.has(value) ? 'selected' : ''}`}>
            <div className="file-item-inner" onClick={() => handleFileSelect(value)}>
            <input
              type="checkbox"
              className="file-checkbox"
              id={`file-${value}`}
              checked={selectedFiles.has(value)}
              onChange={(e) => e.stopPropagation()}
            />
            <span className="file-name">{key}</span>
            </div>
            <button 
              className="view-file-btn" 
              onClick={(e) => handleViewFile(value, e)}
              title="View file content"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 5C7.45 5 3.73 7.94 2 12C3.73 16.06 7.45 19 12 19C16.55 19 20.27 16.06 22 12C20.27 7.94 16.55 5 12 5ZM12 17C8.45 17 5.42 14.88 4 12C5.42 9.12 8.45 7 12 7C15.55 7 18.58 9.12 20 12C18.58 14.88 15.55 17 12 17Z" fill="currentColor"/>
                <path d="M12 9C10.34 9 9 10.34 9 12C9 13.66 10.34 15 12 15C13.66 15 15 13.66 15 12C15 10.34 13.66 9 12 9Z" fill="currentColor"/>
              </svg>
            </button>
          </li>
        );
      } else {
        // It's a folder
        const currentPath = path ? `${path}/${key}` : key;
        
        // Count files in this folder
        const filesInFolder = countFilesInFolder(value);
        
        // Get all file paths in this folder for select/deselect operations
        const filePaths = [];
        getFilePaths(value, filePaths);
        
        // Determine if folder is expanded
        const isExpanded = expandedFolders.has(currentPath);
        
        return (
          <li key={currentPath} className="folder-item">
            <div 
              className={`folder-header ${isExpanded ? 'expanded' : ''}`}
              onClick={() => toggleFolder(currentPath)}
            >
              <button 
                className={`folder-toggle ${isExpanded ? 'expanded' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  toggleFolder(currentPath);
                }}
                aria-label={isExpanded ? 'Collapse folder' : 'Expand folder'}
                aria-expanded={isExpanded}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M9 18L15 12L9 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
              
              <span className="folder-name">
                {key}
                <span className="folder-count">({filesInFolder})</span>
              </span>
            </div>
            
            {isExpanded && (
              <ul className="nested-folder">
                {renderFolderTree(value, expandedFolders, toggleFolder, currentPath, indent + 1)}
              </ul>
            )}
          </li>
        );
      }
    });
  };

  // New function to render the header
  const renderHeader = () => (
    <header className={`app-header ${!isHeaderVisible ? 'header-hidden' : ''}`}>
      <div className="logo-container">
        <h1 className="logo-text">{webname}</h1>
      </div>
      <div className="header-actions">
        {uiState === 'chat' && (
          <button 
            className="btn btn-secondary" 
            onClick={handleStartNewClick}
            disabled={isClearing}
          >
            Start New
          </button>
        )}
        <ThemeToggle />
      </div>
    </header>
  );

  const renderWelcomeView = () => (
    <div className="welcome-container">
      <h1 className="welcome-title">Welcome to <span className='logo-text' style={{"fontSize" : "inherit"}}>{webname}</span></h1>
      <p className="welcome-subtitle">
        Analyze, understand, and explore your codebase with AI assistance.
        Enter a GitHub repository URL below to get started.
      </p>
      <form className="repo-form" onSubmit={handleSubmitRepo}>
        <div className="repo-input-container">
          <input
            type="text"
            className="repo-input"
            value={githubUrl}
            onChange={(e) => setGithubUrl(e.target.value)}
            placeholder="Enter GitHub repository URL (e.g., https://github.com/username/repo)"
            aria-label="GitHub repository URL"
            disabled={apiState !== API_STATUS.IDLE}
          />
        </div>
        <button 
          type="submit" 
          className="btn btn-primary w-full"
          disabled={apiState !== API_STATUS.IDLE || !githubUrl.trim()}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ marginRight: '0.5rem' }}>
            <path d="M21 12L13 4V9C7 10 4 15 3 20C5.5 16.5 9 14.9 13 14.9V20L21 12Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Analyze Repository
        </button>
      </form>
    </div>
  );

  const renderLoadingView = () => (
    <div className="loading-container">
      <div className="spinner">
        <div className="spinner-dot"></div>
        <div className="spinner-dot"></div>
        <div className="spinner-dot"></div>
        <div className="spinner-dot"></div>
        <div className="spinner-dot"></div>
        <div className="spinner-dot"></div>
        <div className="spinner-dot"></div>
        <div className="spinner-dot"></div>
      </div>
      <h2>
        {apiState === API_STATUS.FETCHING 
          ? 'Fetching repository files...' 
          : 'Processing selected files...'}
      </h2>
      
      {apiState === API_STATUS.PROCESSING && processingProgress.total > 0 && (
        <div className="progress-container">
          <div className="progress-bar">
            <div 
              className="progress-fill" 
              style={{ width: `${processingProgress.percentage}%` }}
            ></div>
          </div>
          <p className="progress-text">
            Processing file {processingProgress.processed} of {processingProgress.total}
            {processingProgress.currentFile && `: ${processingProgress.currentFile}`}
          </p>
        </div>
      )}
      
      <p>{statusMessage}</p>
    </div>
  );

  const renderFileSelectionView = () => {
    // Filter files based on search term
    const filteredFiles = fileSearchTerm
      ? files.filter(file => file.toLowerCase().includes(fileSearchTerm.toLowerCase()))
      : files;
    
    // Create folder structure from files
    const folderStructure = getFolderStructure(filteredFiles);
    
    return (
      <div className="file-selection-container">
        <div className="selection-header">
          <h2>Select Files to Analyze</h2>
          <div className="file-search">
            <input
              type="text"
              className="repo-input"
              placeholder="Search files..."
              value={fileSearchTerm}
              onChange={(e) => setFileSearchTerm(e.target.value)}
            />
            {fileSearchTerm && (
              <button 
                className="btn" 
                onClick={() => setFileSearchTerm('')}
                aria-label="Clear search"
                style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', padding: '4px' }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            )}
          </div>
        </div>
        
        {files.length === 0 && (
          <div className="card text-center">
            <h3>No files found in repository</h3>
            <p>This could be due to:</p>
            <ul style={{ textAlign: 'left', marginBottom: 'var(--space-4)' }}>
              <li>The repository is empty</li>
              <li>Files may be in nested directories not visible</li>
              <li>There was an error retrieving files</li>
            </ul>
            <button onClick={() => setUiState('welcome')} className="btn btn-primary">
              Go Back
            </button>
          </div>
        )}
        
        {files.length > 0 && (
          <>
            <div className="file-controls">
              <button onClick={handleSelectAll} className="btn btn-secondary">
                {selectedFiles.size === filteredFiles.length && filteredFiles.length > 0 
                  ? 'Deselect All' 
                  : 'Select All'}
              </button>
              <span className="file-count">
                {selectedFiles.size} file{selectedFiles.size !== 1 ? 's' : ''} selected
              </span>
            </div>
            
            <div className="file-browser">
              {filteredFiles.length > 0 ? (
                <ul className="file-list">
                  {Object.keys(folderStructure).length > 0 ? (
                    renderFolderTree(folderStructure, expandedFolders, toggleFolder)
                  ) : (
                    // Fallback to old file list if structure is empty
                    filteredFiles.map((file, index) => (
                      <li key={index} 
                        className={`file-item ${selectedFiles.has(file) ? 'selected' : ''}`}>
                        <div className="file-item-inner" onClick={() => handleFileSelect(file)}>
                        <input
                          type="checkbox"
                          className="file-checkbox"
                          id={`file-${index}`}
                          checked={selectedFiles.has(file)}
                          onChange={(e) => e.stopPropagation()}
                        />
                        <span className="file-name">{file}</span>
                        </div>
                        <button 
                          className="view-file-btn" 
                          onClick={(e) => handleViewFile(file, e)}
                          title="View file content"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M12 5C7.45 5 3.73 7.94 2 12C3.73 16.06 7.45 19 12 19C16.55 19 20.27 16.06 22 12C20.27 7.94 16.55 5 12 5ZM12 17C8.45 17 5.42 14.88 4 12C5.42 9.12 8.45 7 12 7C15.55 7 18.58 9.12 20 12C18.58 14.88 15.55 17 12 17Z" fill="currentColor"/>
                            <path d="M12 9C10.34 9 9 10.34 9 12C9 13.66 10.34 15 12 15C13.66 15 15 13.66 15 12C15 10.34 13.66 9 12 9Z" fill="currentColor"/>
                          </svg>
                        </button>
                      </li>
                    ))
                  )}
                </ul>
              ) : (
                <div className="card text-center">
                  {fileSearchTerm ? 'No matching files found' : 'No files available'}
                </div>
              )}
            </div>
            
            <div className="mt-auto">
              <button 
                onClick={handleProcessSelectedFiles} 
                disabled={selectedFiles.size === 0}
                className="btn btn-primary w-full"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ marginRight: '0.5rem' }}>
                  <path d="M9 16.2L4.8 12L3.4 13.4L9 19L21 7L19.6 5.6L9 16.2Z" fill="currentColor"/>
                </svg>
                Analyze {selectedFiles.size} Selected File{selectedFiles.size !== 1 ? 's' : ''}
              </button>
            </div>
          </>
        )}
      </div>
    );
  };

  // File viewer modal component
  const renderFileViewerModal = () => {
    if (!fileViewerOpen) return null;
    
    // Determine file extension for syntax highlighting
    const fileExtension = viewingFile.path.split('.').pop()?.toLowerCase() || '';
    
    return (
      <div className="modal-overlay" onClick={closeFileViewer}>
        <div className="file-viewer-modal" onClick={e => e.stopPropagation()}>
          <div className="file-viewer-header">
            <h3>{viewingFile.path}</h3>
            <button className="close-modal-btn" onClick={closeFileViewer} aria-label="Close">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>
          <div className="file-viewer-content">
            {isLoadingFileContent ? (
              <div className="file-content-loading">
                <div className="spinner">
                  <div className="spinner-dot"></div>
                  <div className="spinner-dot"></div>
                  <div className="spinner-dot"></div>
                  <div className="spinner-dot"></div>
                  <div className="spinner-dot"></div>
                </div>
                <p>Loading file content...</p>
              </div>
            ) : (
              <pre className={`file-content language-${fileExtension}`}>
                <code>
                  {viewingFile.content}
                </code>
              </pre>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderChatView = () => {
    return <Neo4jChatInterface repoId={repoId} onBackToHome={handleBackToHome} onStartNew={handleStartNewClick} />;
  };

  // Main render logic
  const renderContent = () => {
    switch (uiState) {
      case 'welcome':
        return renderWelcomeView();
      case 'loading':
        return renderLoadingView();
      case 'file-selection':
        return renderFileSelectionView();
      case 'chat':
        return renderChatView();
      default:
        return renderWelcomeView();
    }
  };

  return (
    <div className={`app-container ${theme}-theme`}>
      {renderHeader()}
      <main className={`main-container ${theme}-theme`}>
        {renderContent()}
      </main>
      
      {/* Confirmation Dialog */}
      {showConfirmDialog && (
        <div className="confirm-dialog">
          <div className="dialog-content">
            <h3 className="dialog-title">Start New Analysis?</h3>
            <p>This will clear all current data and conversations. Are you sure?</p>
            <div className="dialog-buttons">
              <button 
                className="btn dialog-cancel"
                onClick={handleCancelStartNew}
                disabled={isClearing}
              >
                Cancel
              </button>
              <button 
                className="btn dialog-confirm"
                onClick={handleConfirmStartNew}
                disabled={isClearing}
              >
                {isClearing ? 'Clearing...' : 'Yes, Start New'}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* File Viewer Modal */}
      {renderFileViewerModal()}
    </div>
  );
}

export default App;