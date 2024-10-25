import os
import asyncio
import json
import re
from metagpt.context import Context
from fileidentifier import FileIdentifier
from developer import Developer
from replacer import Replacer

# Define the user message
msg = """
Add 5 actors to the simulation with random usernames and profile information. Choose a random file in the directory ./profile_photos/unused
"""

# Paths to knowledge base and file structure
KNOWLEDGE_BASE_PATH = "data/knowledge_base.json"
FILE_STRUC_PATH = "data/file_structure.json"
FILE_DESC_PATH = "data/file_descriptions.json"

# Create 'outputs' folder if it doesn't exist
output_folder = "outputs"
if not os.path.exists(output_folder):
    os.makedirs(output_folder)

# Sanitize the message to create a valid result filename and store it in the 'outputs' folder
result_filename = re.sub(r'[^a-zA-Z0-9]', '_', msg[:30]) + '_result.txt'
result_file_path = os.path.join(output_folder, result_filename)

async def run_agents(msg: str):
    # Load necessary JSON files
    with open(KNOWLEDGE_BASE_PATH, "r") as f:
        knowledge_base = json.load(f)
    with open(FILE_STRUC_PATH, "r") as f:
        file_structure = json.load(f)
    with open(FILE_DESC_PATH, "r") as f:
        file_descriptions = json.load(f)
    
    context = Context()

    # Prepare a list to compile the results from all agents
    results = []

    # Append the initial user message
    results.append(f"User request: {msg}\n")

    # Run FileIdentifier agent and collect its result
    file_identifier = FileIdentifier(
        context=context, 
        msg=msg, 
        knowledge_base=knowledge_base, 
        file_structure=file_structure, 
        file_descriptions=file_descriptions
    )
    file_identifier_result = await file_identifier.run(msg)
    results.append(f"File Identifier result: {file_identifier_result}\n")

    # Run Developer agent and collect its result
    developer = Developer(
        context=context, 
        msg=msg, 
        knowledge_base=knowledge_base, 
        file_identifier_result=file_identifier_result
    )
    developer_result = await developer.run(file_identifier_result)
    results.append(f"Developer result: {developer_result}\n")

    # Run Replacer agent and collect its result
    replacer = Replacer(context=context, developer_output=developer_result)
    replacer_result = await replacer.run(developer_result)
    results.append(f"Replacer result: {replacer_result}\n")

    # Write the compiled results to a text file
    with open(result_file_path, 'w') as f:
        f.writelines(results)

if __name__ == '__main__':
    # Run the event loop for agents
    asyncio.run(run_agents(msg))



