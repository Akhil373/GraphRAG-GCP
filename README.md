# AI-Powered Intelligent Discovery Tool for Legacy Applications

This project is an AI-powered intelligent discovery tool designed to help users understand legacy application functionalities. It allows users to upload legacy code repositories via GitHub links, automatically parses and analyzes the code, constructs a knowledge graph, and provides a chat-like interface to query for features, requirements, dependencies, integration points, and database entities.

## Project Overview

The system is composed of a frontend application, a backend service for repository handling, and several serverless functions for code processing and knowledge graph construction. The core idea is to transform legacy code into a structured knowledge graph that can be queried using natural language, powered by AI models.

## Features

*   **GitHub Repository Ingestion:** Users can provide a GitHub URL to import legacy code.
*   **File Selection:** Users can select specific files from the repository for analysis.
*   **Automated Code Parsing:** Legacy code is parsed to extract structural and semantic insights. This involves:
    *   Language detection.
    *   Extraction of code entities (functions, classes, variables, operations, etc.).
    *   Identification of relationships between these entities.
*   **Knowledge Graph Construction:**
    *   Parsed data is used to build a knowledge graph in Neo4j.
    *   Text embeddings are generated for code descriptions to enable semantic search.
*   **AI-Powered Chat Interface:**
    *   Users can ask natural language questions about the codebase.
    *   The system uses a Retrieval Augmented Generation (RAG) approach, querying the Neo4j graph for context and using a Large Language Model (LLM) to generate answers.
*   **Graph Visualization:** Provides an interactive 2D force-directed graph of the selected file's components and their relationships.
*   **Contextual Analysis:** Users can chat about the entire repository or focus on a specific file.

## Architecture

The application follows a microservices-oriented architecture with a React frontend, a Flask backend for primary operations, and Google Cloud Functions for specialized processing tasks.

### 1. Frontend (`frontend/`)

Built with React, the frontend provides the user interface for interacting with the system.

*   **`App.jsx`**: The main application component.
    *   Manages overall UI state (welcome, loading, file selection, chat).
    *   Handles GitHub URL input and initiates repository fetching.
    *   Manages file selection from the cloned repository.
    *   Initiates file processing and polls for status updates.
    *   Provides a "Start New" feature to clear data and begin a new analysis.
    *   Includes a file viewer modal to display content of selected files.
*   **`components/Neo4jChatInterface.jsx`**: The main interactive dashboard.
    *   Integrates `FileList`, `ChatPanel`, `GraphControls`, and `GraphView`.
    *   Manages selection between file-specific context and repository-wide context for chat and visualization.
    *   Fetches data for the file list, specific file details, and graph visualization from the RAG API service.
*   **`components/FileList.jsx`**:
    *   Displays a list of files from the processed repository.
    *   Allows users to select a file for detailed analysis or choose "Repo Context" for a repository-wide view.
    *   Fetches file list from the RAG API.
*   **`components/ChatPanel.jsx`**:
    *   Renders the chat interface (message history, input field).
    *   Formats AI responses, including Markdown and syntax-highlighted code blocks.
    *   Handles user input and sends queries to the RAG API service.
*   **`components/GraphView.jsx`**:
    *   Visualizes the code knowledge graph using `react-force-graph-2d`.
    *   Displays nodes (code entities) and links (relationships).
    *   Offers interactive features like zoom, pan, and node highlighting based on chat context.
    *   Node and link appearances are customized based on their types.
*   **`components/GraphControls.jsx`**:
    *   Provides UI elements (checkboxes, sliders) to filter the graph visualization by node types and relationship types.
    *   Allows control over graph layout parameters like node size and link strength.
*   **`components/ThemeToggle.jsx`**: Allows users to switch between light and dark themes.
*   **`ThemeContext.jsx`**: Provides theme state to the application.

### 2. Backend (`backend/`)

#### a. Main API Service (`backend/app.py`)

A Flask application responsible for initial repository handling and coordinating the processing workflow.

*   **Functions:**
    *   `list_files_in_directory()`: Recursively lists files in a directory, excluding `.git` and hidden files.
    *   `process_files_in_batches()`: Uploads selected files to Google Cloud Storage (GCS) in batches and monitors their processing by downstream services. Includes logic to verify ingestion into Neo4j.
    *   `verify_batch_in_neo4j()`: Checks if a batch of uploaded files has corresponding nodes in Neo4j.
    *   `wait_for_neo4j_processing()`: Polls Neo4j to determine when processing of all uploaded files is complete or has reached a timeout/partial success state.
*   **API Endpoints:**
    *   `POST /api/fetch-repo-files`: Clones a GitHub repository, lists its files, and returns the file list and a `repo_id`. Calls the RAG API to clear the database before cloning.
    *   `POST /api/process-files`: Receives selected files and `repo_id`, uploads files to GCS, and starts the asynchronous processing workflow.
    *   `GET /api/processing-status`: Allows the frontend to poll the status of file processing and Neo4j ingestion.
    *   `POST /api/get-file-content`: Returns the content of a specific file from the locally cloned repository.

#### b. Code Parser Cloud Function (`backend/code_parser_function/main.py`)

A Google Cloud Function triggered by file uploads to a GCS bucket.

*   **Functions:**
    *   `CodeEntity` & `CodeRelationship` (Classes): Data structures for representing parsed code elements and their connections.
    *   `CodeParser.detect_language()`: Detects the programming language of a code file.
    *   `CodeParser.extract_with_ai()`: Uses a Vertex AI Gemini model to parse code and extract entities/relationships. This is the primary parsing method.
    *   `CodeParser.get_full_function_body()`: Extracts the complete body of a function.
    *   `CodeParser.extract_with_regex()`: A fallback regex-based parser if AI parsing fails.
    *   `code_parser_entrypoint()`: Main function triggered by GCS. Downloads the file, parses it, and uploads the structured JSON output (entities, relationships) to another GCS bucket.
*   **Core Logic:** Parses individual code files to identify components like functions, classes, variables, and their relationships. It prioritizes AI-based parsing for deeper understanding and falls back to regex for broader compatibility.

#### c. Graph Ingestor Cloud Function (`backend/graph_ingestor_function/main.py`)

A Google Cloud Function triggered by the JSON output from the Code Parser function.

*   **Functions:**
    *   `get_neo4j_driver()`: Initializes and connects to the Neo4j database.
    *   `generate_embeddings()`: Generates vector embeddings for entity descriptions using Vertex AI's text embedding model.
    *   `ingest_data_to_neo4j()`: Processes the parsed JSON data. Creates nodes for files and code entities (e.g., `Function`, `Class`, `Operation`) in Neo4j, sets their properties (including embeddings and `repo_id`), and creates relationships between them.
    *   `graph_ingestor_entrypoint()`: Main function triggered by GCS. Downloads the parsed JSON, connects to Neo4j, and ingests the data.
*   **Core Logic:** Populates the Neo4j database with the structured data extracted from code files, creating the knowledge graph. Embeddings are added to nodes to support semantic search.

#### d. RAG API Service (`backend/rag_api_service/app.py`)

A Flask application that provides the RAG (Retrieval Augmented Generation) capabilities and graph data access.

*   **Functions:**
    *   `get_neo4j_driver()`: Initializes and connects to the Neo4j database.
    *   `create_vector_indexes()`: On startup, creates (or recreates) vector indexes in Neo4j on the `embedding` property of `File`, `Function`, and `Operation` nodes to speed up similarity searches.
    *   `generate_embeddings()`: Generates embeddings for user queries.
    *   `retrieve_graph_context()`: Retrieves context from Neo4j for a general query. Uses a hybrid approach: vector search, graph traversal (APOC), shortest path, and keyword search.
    *   `retrieve_file_specific_context()`: Retrieves context focused on a specific file, first attempting vector search within the file, then falling back to a general entity listing for that file.
*   **API Endpoints:**
    *   `POST /api/chat`: The main chat endpoint.
        1.  Generates an embedding for the user's query.
        2.  Retrieves relevant context from Neo4j using vector search and graph traversals, tailored to whether the query is for the whole repo or a specific file.
        3.  Constructs a prompt with the query, history, and retrieved context.
        4.  Sends the prompt to a Vertex AI Gemini model to generate a response.
    *   `GET /healthz`: Health check endpoint.
    *   `POST /api/clear-database`: Clears all data from the Neo4j database.
    *   `GET /api/graph/files`: Lists all files for a given `repo_id` from the Neo4j graph.
    *   `GET /api/graph/file-data`: Retrieves detailed information about a specific file and its directly related entities from Neo4j.
    *   `GET /api/graph/file-graph`: Retrieves nodes and relationships for visualizing a specific file and its 2-hop neighborhood from Neo4j.

## Setup Instructions

*(This section is intentionally left blank for you to add your specific setup instructions.)*

## How It Works

1.  **Input:** The user provides a GitHub URL to the frontend.
2.  **Cloning & File Listing:** The backend `app.py` clones the repository locally and lists its files. The user selects files for analysis.
3.  **File Upload to GCS:** Selected files are uploaded by `app.py` to a Google Cloud Storage bucket. Each file is tagged with a `repo_id` and its original path.
4.  **Code Parsing (Cloud Function):** The `code_parser_function` is triggered by file uploads. It:
    *   Detects the programming language.
    *   Uses Vertex AI (Gemini) and regex to parse the file content, extracting entities (functions, classes, variables, etc.) and their relationships.
    *   Outputs a JSON file containing this structured data to another GCS bucket.
5.  **Graph Ingestion (Cloud Function):** The `graph_ingestor_function` is triggered by the JSON output from the parser. It:
    *   Generates text embeddings for descriptions of the extracted entities using Vertex AI.
    *   Connects to Neo4j and ingests the entities and relationships, building the knowledge graph. Nodes store properties like `repo_id`, `name`, `description`, and the generated `embedding`.
6.  **Polling for Completion:** The frontend polls `app.py`'s `/api/processing-status` endpoint, which in turn checks if the data has appeared in Neo4j.
7.  **Chat & Discovery (RAG API Service):**
    *   Once processing is complete, the user can interact with the chat interface.
    *   User queries are sent to the `rag_api_service`.
    *   The service generates an embedding for the query.
    *   It queries Neo4j using a combination of vector similarity search (on entity embeddings) and graph traversal techniques to find relevant context from the knowledge graph.
    *   This retrieved context, along with the original query and chat history, is fed to a Vertex AI LLM (Gemini).
    *   The LLM generates a natural language response based on the provided information.
8.  **Visualization:** The frontend fetches graph data from the `rag_api_service` to render an interactive visualization of the selected file's structure and connections.

## Technologies Used

*   **Frontend:** React, Axios, `react-resizable-panels`, `react-force-graph-2d`, `marked`, `DOMPurify`, `react-syntax-highlighter`.
*   **Backend (Main API & RAG Service):** Python, Flask, Flask-CORS.
*   **Serverless Functions:** Google Cloud Functions (Python runtime).
*   **Code Analysis & Generation:** Vertex AI (Gemini Pro/Flash for generation, Text Embedding Model for embeddings).
*   **Database:** Neo4j (Graph Database).
*   **Storage:** Google Cloud Storage (GCS).
*   **Repository Cloning:** GitPython.
*   **Environment Management:** `dotenv`.
*   **Notifications:** `react-push-notification`.
