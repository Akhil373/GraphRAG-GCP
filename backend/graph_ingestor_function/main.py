import os
import json
import re
from google.cloud import storage
from neo4j import GraphDatabase
import vertexai
from vertexai.language_models import TextEmbeddingModel
from vertexai.generative_models import GenerativeModel

storage_client = storage.Client()
vertexai.init(project=os.environ.get('GCP_PROJECT_ID'), location='us-central1')
embedding_model = TextEmbeddingModel.from_pretrained("text-embedding-large-exp-03-07")

NEO4J_URI = os.getenv("NEO4J_URI")
NEO4J_USERNAME = os.getenv("NEO4J_USERNAME")
NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD")

neo4j_driver = None
def get_neo4j_driver():
    global neo4j_driver
    if neo4j_driver is None:
        if not all([NEO4J_URI, NEO4J_USERNAME, NEO4J_PASSWORD]):
            raise ValueError("Neo4j credentials are not set in environment variables.")
        
        uri = str(NEO4J_URI) if NEO4J_URI is not None else ""
        username = str(NEO4J_USERNAME) if NEO4J_USERNAME is not None else ""
        password = str(NEO4J_PASSWORD) if NEO4J_PASSWORD is not None else ""
        
        if not uri or not username or not password:
            raise ValueError("Neo4j credentials cannot be empty.")
            
        neo4j_driver = GraphDatabase.driver(uri, auth=(username, password))
        neo4j_driver.verify_connectivity()
        print("Neo4j driver initialized and connected.")
    return neo4j_driver

def generate_embeddings(text):
    try:
        embeddings = embedding_model.get_embeddings([text])
        return embeddings[0].values
    except Exception as e:
        print(f"Error generating embedding for text: '{text[:50]}...': {e}")
        return []

def ingest_data_to_neo4j(parsed_data, session):
    repo_id = parsed_data.get('repo_id')
    filename = parsed_data.get('filename')
    entities = parsed_data.get('entities', [])
    relationships = parsed_data.get('relationships', [])
    context_sample = parsed_data.get('context_sample', '')

    if not filename:
        print("Skipping ingestion: filename is missing from parsed data.")
        return

    file_extension = os.path.splitext(filename)[1].lower()
    
    file_type = "SourceFile"
    
    if file_extension in ['.py']:
        file_type = "PythonModule"
    elif file_extension in ['.js', '.jsx', '.ts', '.tsx']:
        file_type = "JavaScriptModule"
    elif file_extension in ['.java']:
        file_type = "JavaClass" 
    elif file_extension in ['.c', '.cpp', '.cc', '.cxx']:
        file_type = "CppFile"
    elif file_extension in ['.cob', '.cbl', '.cpy']:
        file_type = "CobolProgram"
    elif file_extension in ['.sas']:
        file_type = "SasProgram"
    elif file_extension in ['.jcl']:
        file_type = "JclJob"
    elif file_extension in ['.flink', '.flk']:
        file_type = "FlinkJob"
    elif file_extension in ['.rpg', '.rpgle']:
        file_type = "RpgProgram"
    elif file_extension in ['.pli', '.pl1']:
        file_type = "PliProgram"
    elif file_extension in ['.asm', '.s', '.S']:
        file_type = "AssemblyFile"
    elif file_extension in ['.for', '.f', '.f77', '.f90']:
        file_type = "FortranProgram"
    elif file_extension in ['.html', '.xml', '.json', '.yaml', '.yml', '.csv', '.dat']:
        file_type = "DataFile"
    
    session.run(
        f"MERGE (f:{file_type}:File {{path: $filename}}) " 
        "SET f.repo_id = $repo_id, f.name = $file_name, "
        "f.extension = $extension, f.context_sample = $context_sample",
        filename=filename, 
        repo_id=repo_id, 
        file_name=os.path.basename(filename), 
        extension=file_extension,
        context_sample=context_sample
    )

    operation_entities = []

    label_mapping = {
        'function': 'Function',
        'method': 'Function',
        'variable': 'Variable',
        'struct': 'Struct',
        'record': 'Record',
        'type': 'Type',
        'module': 'Module',
        'file': 'Module',
        'class': 'Class',
        'object': 'Object',
        'database_table': 'DatabaseTable',
        'entity': 'Entity',
        'external_api': 'ExternalAPI',
        'service': 'Service',
        'business_rule': 'BusinessRule',
        'requirement': 'Requirement',
        'loop': 'Loop',
        'branch': 'Branch',
        'input_operation': 'InputOperation',
        'output_operation': 'OutputOperation',
        'user_input': 'UserInput',
        'job': 'Job',
        'script': 'Script',
        'program': 'Program',
        'constant': 'Constant',
        'interface': 'Interface',
        'import': 'Import',
        'paragraph': 'Paragraph',
        'enum': 'Enum',
        'define': 'Define',
        'operation': 'Operation'
    }

    for entity in entities:
        entity_name = entity.get('name')
        entity_type = entity.get('entity_type', 'Entity') 
        description = entity.get('description', '')
        
        if entity_type.lower() == 'operation':
            operation_entities.append(entity)
            continue
            
        entity_type_str = str(entity_type).lower() if entity_type else 'entity'
        node_label = label_mapping.get(entity_type_str, entity_type_str.capitalize())
        
        if not re.match(r'^[A-Za-z][A-Za-z0-9_]*$', node_label):
            node_label = 'Entity'

        embedding = generate_embeddings(description)
        
        properties = entity.get('properties', {})
        property_cypher = ""
        property_params = {
            'file_path': entity.get('file_path', filename),
            'name': entity_name,
            'description': description,
            'embedding': embedding,
            'repo_id': repo_id
        }
        
        context_sample = properties.get('context_sample', '')
        if not context_sample and 'code' in entity:
            context_sample = entity.get('code', '')
        if context_sample:
            property_params['context_sample'] = context_sample
            property_cypher += ", e.context_sample = $context_sample"
        
        if properties.get('original_name'):
            property_params['original_name'] = properties.get('original_name')
            property_cypher += ", e.original_name = $original_name"
        
        if properties.get('source_file'):
            property_params['source_file'] = properties.get('source_file')
            property_cypher += ", e.source_file = $source_file"
        
        for prop_key, prop_value in properties.items():
            if prop_key in ['original_name', 'source_file']:
                continue
                
            prop_key_str = str(prop_key)
            if prop_value is not None and re.match(r'^[A-Za-z][A-Za-z0-9_]*$', prop_key_str):
                if isinstance(prop_value, (list, dict)):
                    prop_value = json.dumps(prop_value)
                property_cypher += f", e.{prop_key_str} = ${prop_key_str}"
                property_params[prop_key_str] = prop_value

        cypher = f"""
        MATCH (f:{file_type} {{path: $file_path}})
        MERGE (e:{node_label} {{name: $name, file_path: $file_path}})
        ON CREATE SET e.description = $description, e.embedding = $embedding, e.repo_id = $repo_id{property_cypher}
        ON MATCH SET e.description = $description, e.embedding = $embedding, e.repo_id = $repo_id{property_cypher}
        MERGE (f)-[:CONTAINS]->(e)
        """
        
        session.run(cypher, property_params)

    for entity in operation_entities:
        entity_name = entity.get('name')
        description = entity.get('description', '')
        
        embedding = generate_embeddings(description)
        
        properties = entity.get('properties', {})
        code_snippet = properties.get('code_snippet', '')
        operation_type = properties.get('operation_type', 'operation')
        source_file = properties.get('source_file', os.path.basename(filename))
        
        cypher = """
        MATCH (f:File {path: $file_path})
        MERGE (o:Operation {name: $name, file_path: $file_path})
        ON CREATE SET o.description = $description, 
                      o.embedding = $embedding,
                      o.code_snippet = $code_snippet, 
                      o.operation_type = $operation_type,
                      o.source_file = $source_file,
                      o.repo_id = $repo_id
        ON MATCH SET o.description = $description, 
                     o.embedding = $embedding,
                     o.code_snippet = $code_snippet,
                     o.operation_type = $operation_type,
                     o.source_file = $source_file,
                     o.repo_id = $repo_id
        MERGE (f)-[:CONTAINS_OPERATION]->(o)
        """
        
        session.run(cypher, {
            'file_path': filename,
            'name': entity_name,
            'description': description,
            'embedding': embedding,
            'code_snippet': code_snippet,
            'operation_type': operation_type,
            'source_file': source_file,
            'repo_id': repo_id
        })

    rel_mapping = {
        'calls': 'CALLS',
        'returns': 'RETURNS',
        'defines': 'DEFINES',
        'includes': 'INCLUDES',
        'imports': 'IMPORTS',
        'depends_on': 'DEPENDS_ON',
        'declares': 'DECLARES',
        'uses': 'USES',
        'assigns': 'ASSIGNS',
        'reads_from': 'READS_FROM',
        'writes_to': 'WRITES_TO',
        'interacts_with': 'INTERACTS_WITH',
        'logs_to': 'LOGS_TO',
        'composes': 'COMPOSES',
        'contains': 'CONTAINS',
        'extends': 'EXTENDS',
        'inherits': 'INHERITS_FROM',
        'executes': 'EXECUTES',
        'calls_with_input_from': 'CALLS_WITH_INPUT_FROM',
        'satisfies': 'SATISFIES',
        'triggered_by': 'TRIGGERED_BY',
        'controls_flow_to': 'CONTROLS_FLOW_TO',
        'spawns': 'SPAWNS',
        'allocates': 'ALLOCATES',
        'deallocates': 'DEALLOCATES',
        'implements': 'IMPLEMENTS',
        'overrides': 'OVERRIDES'
    }

    for rel in relationships:
        source_name = rel.get('source')
        target_name = rel.get('target')
        rel_type = rel.get('relationship_type', 'RELATED_TO')
        
        rel_type_str = str(rel_type).lower() if rel_type else 'related_to'
        rel_type_upper = rel_mapping.get(rel_type_str, rel_type_str.upper())
        
        sanitized_rel_type = re.sub(r'[^A-Z_]', '', rel_type_upper)

        if not all([source_name, target_name, sanitized_rel_type]):
            continue

        cypher = f"""
        MATCH (source {{name: $source_name, file_path: $filename, repo_id: $repo_id}})
        MATCH (target {{name: $target_name, repo_id: $repo_id}})
        MERGE (source)-[r:{sanitized_rel_type}]->(target)
        SET r.context = $context
        """
        
        session.run(cypher, {
            'source_name': source_name,
            'target_name': target_name,
            'filename': filename,
            'context': rel.get('context', ''),
            'repo_id': repo_id
        })

    print(f"Ingested data for {filename} into Neo4j with enhanced entity and relationship handling.")


def graph_ingestor_entrypoint(event, context):
    bucket_name = event['bucket']
    file_name = event['name']

    print(f"Processing parsed file: {file_name} from bucket: {bucket_name}")

    if not file_name.endswith('.json'):
        print(f"Skipping non-JSON file: {file_name}")
        return

    try:
        bucket = storage_client.bucket(bucket_name)
        blob = bucket.blob(file_name)
        
        metadata = blob.metadata or {}
        repo_id_from_metadata = metadata.get('repo_id')
        
        parsed_data_content = blob.download_as_text()
        parsed_data = json.loads(parsed_data_content)
        
        if repo_id_from_metadata:
            parsed_data['repo_id'] = repo_id_from_metadata
            print(f"Using repo_id from metadata: {repo_id_from_metadata}")
        else:
            print(f"No repo_id in metadata, using from content: {parsed_data.get('repo_id', 'unknown')}")

        driver = get_neo4j_driver()
        with driver.session() as session:
            ingest_data_to_neo4j(parsed_data, session)

    except Exception as e:
        print(f"Error ingesting {file_name}: {e}")
        raise