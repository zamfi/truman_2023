import json
import os
import re
import logging
from metagpt.context import Context
from metagpt.roles import Role
from metagpt.actions import Action
import os
import json
import re
import logging
import asyncio

# TODO: filepath, description, modified content

root_directory = "/Users/jessiejia/24FA/truman_2023/"

class Developer(Action):
    """
    FileIdentifier searches for relevant files that may need to be modified based on the tasks.
    """
    
    
    PROMPT_TEMPLATE: str = """
    ## Task: {task}
    ## File Content: {file_content}
    ## User Request: {user_request}

    Role: You are tasked with applying the specific changes from the 'Task' to the 'File Content' based on the 'User Request'.
    Your output should be in the following JSON format, which includes the file path, a brief description of changes, and the modified file content.

    The output should only contain the modified code, with nothing else. 
    The output should only contain the modified code, with nothing else. 
    """

   


    name: str = "FileIdentifier"

    async def run(self, file_identifier_output: str, user_request: str) -> str:
        """
        Parses the output from FileIdentifier and modifies the files based on tasks.
        :param file_identifier_output: The JSON data listing files and tasks.
        :param user_request: The overarching task or user request description.
        :return: Modified content for each file.
        """
        
        parsed_data = self.parse_json(file_identifier_output)
        
        if not parsed_data:
            return "Error: No valid data found."
        
        result = []
        for file_info in parsed_data:
            file_path = file_info.get('filePath')
            changes_summary = file_info.get('changes')

            if file_path and changes_summary:
                # Safely concatenate paths
                full_file_path = os.path.join(root_directory, file_path)
                
                # Read the original file content
                original_content = self.read_file(full_file_path)
                
                if original_content:
                    # Generate the prompt
                    prompt = self.PROMPT_TEMPLATE.format(
                        task=changes_summary, 
                        file_content=original_content, 
                        user_request=user_request,
                    )
                    
                    # Generate the modified content using the prompt
                    modified_content = await self._aask(prompt)
                    result.append({
                        "filePath": full_file_path,
                        "description": changes_summary,  # Shortened summary for the description
                        "modifiedContent": modified_content
                    })
                else:
                    logging.warning(f"Unable to read the file: {file_path}")
        
        # Return the result as a formatted JSON string
        print(f"developer result: {result}")
        return json.dumps(result, indent=2)

    def read_file(self, path: str) -> str:
        """
        Reads the contents of the given file.
        :param path: File path to read.
        :return: Contents of the file.
        """
        if os.path.exists(path):
            with open(path, 'r') as f:
                return f.read()
        else:
            logging.warning(f"File not found: {path}")
            return ""

    def parse_json(self, input_string: str) -> list:
        """
        Extracts and parses the JSON content from the input string.
        :param input_string: String containing the JSON block.
        :return: Parsed JSON data as a list of dictionaries.
        """
        try:
            parsed_data = json.loads(input_string)
            return parsed_data
        except json.JSONDecodeError as e:
            logging.error(f"Error decoding JSON: {e}")
            return None


# For testing purposes
async def main():
    input_task = """
    For each actor post, add a box above the comment box. The box should include a feeling prompt question: “How is Jane Doe feeling?” where the name "Jane Doe" is customized by the original poster's name.
    """
    
    file_identifier_output = """
    [
    {
        "filePath": "models/Script.js",
        "changes": "Modify the schema to include new fields for each reaction type ('love', 'haha', 'wow', 'sad', 'angry') to track the number of each reaction a post receives."
    },
    {
        "filePath": "views/script.pug",
        "changes": "Update the UI to include new reaction buttons with emojis for each reaction type under each post."
    }
    ]
    """
    
    role = Developer()  # Initialize the role correctly
    result = await role.run(file_identifier_output, input_task)
    print("Here's the result:\n" + result)

# Run the async function
asyncio.run(main())


