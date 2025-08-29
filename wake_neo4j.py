import os
import time
from neo4j import GraphDatabase

def wait_for_db(uri, user, password, retries=12, delay=10):
    driver = GraphDatabase.driver(uri, auth=(user, password))
    for i in range(retries):
        try:
            with driver.session() as session:
                    session.run("""
                        MERGE (h:Heartbeat {id: 1})
                        SET h.lastPing = datetime()
                        RETURN h
                    """)
            print("Aura Free DB is online")
            driver.close()
            return True
        except Exception as e:
            print(f"Attempt {i+1}/{retries} failed: {e}")
            time.sleep(delay)
    driver.close()
    raise TimeoutError("Aura DB did not resume in time")

if __name__ == "__main__":
    uri = os.getenv("NEO4J_URI")
    user = os.getenv("NEO4J_USERNAME")
    password = os.getenv("NEO4J_PASSWORD")

    if not uri or not user or not password:
         raise RuntimeError(f"Missing credentials. Got NEO4J_URI={uri}, NEO4J_USER={user}, NEO4J_PASSWORD={'set' if password else 'missing'}") 

    print("Waking up Neo4j Aura Free instance...")
    wait_for_db(uri, user, password)
