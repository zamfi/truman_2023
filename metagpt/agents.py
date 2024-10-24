import asyncio
import json
import logging
from metagpt.logs import logger  # Keep using the existing logger
from metagpt.context import Context
from fileidentifier import FileIdentifier
from developer import Developer
from replacer import Replacer

msg = """
    For each actor post, add a box above the comment box. The box should include a feeling prompt question: “How is Jane Done feeling?” where the name "Jane Doe" is customized by the original poster's name. 
    """

# Paths to knowledge base and file structure
KNOWLEDGE_BASE_PATH = "data/knowledge_base.json"
FILE_STRUC_PATH = "data/file_structure.json"
FILE_DESC_PATH = "data/file_descriptions.json"

# Configure the logger to output logs to both console and a file
logging.basicConfig(
    filename= msg[:6] + '.txt',  # The file to which logs will be written
    level=logging.INFO,  # Log level set to INFO to capture all important messages
    format='%(asctime)s - %(levelname)s - %(message)s'  # Log message format
)

async def run_agents(msg: str):
    with open(KNOWLEDGE_BASE_PATH, "r") as f:
        knowledge_base = json.load(f)
    with open(FILE_STRUC_PATH, "r") as f:
        file_structure = json.load(f)
    with open(FILE_DESC_PATH, "r") as f:
        file_descriptions = json.load(f)
    
    context = Context()
    
    # Log the initial user message
    logger.info(f"User request: {msg}")

    # Run FileIdentifier agent
    file_identifier = FileIdentifier(
        context=context, 
        msg=msg, 
        knowledge_base=knowledge_base, 
        file_structure=file_structure, 
        file_descriptions=file_descriptions
    )
    file_identifier_result = await file_identifier.run(msg)
    logger.info(f"File Identifier result: {file_identifier_result}")

    # Run Developer agent
    developer = Developer(
        context=context, 
        msg=msg, 
        knowledge_base=knowledge_base, 
        file_identifier_result=file_identifier_result
    )
    developer_result = await developer.run(file_identifier_result)
    logger.info(f"Developer result: {developer_result}")

    # Run Replacer agent
    replacer = Replacer(context=context, developer_output=developer_result)
    replacer_result = await replacer.run(developer_result)
    logger.info(f"Replacer result: {replacer_result}")

if __name__ == '__main__':
    # Define the user message / requirement
    
    
    # Run the event loop for agents
    asyncio.run(run_agents(msg))
