import json
import os
from metagpt.actions import Action
import re

class WriteCode(Action):
    PROMPT_TEMPLATE: str = """
    ### User Request: 
    {msg}

    ### Knowledge Base:
    {knowledge_base}

    ### Files to change (full content):
    {file_contents}

    Based on the user request and the current state of the files provided above, find the specific sections where the changes should be made. Only modify the parts that relate to the user request.

    The output should be a JSON dictionary where:
    - The key is the file path,
    - The value is the updated content of that file based on the user request.

    Make sure to only modify the necessary sections and ensure the overall integrity of the code is preserved.

    Example output:
    ```json
    {{
        "path/to/file1.pug": "updated content for file1.pug",
        "path/to/file2.pug": "updated content for file2.pug"
    }}
    ```

    Return nothing else but the JSON and a short description of the change.
    """

    name: str = "WriteCode"

    async def run(self, msg: str, knowledge_base: dict, file_identifier_result: str):
        # Step 1: Extract the JSON content from the input string using regex
        json_content = re.search(r'```json\s*(.*?)\s*```', file_identifier_result, re.DOTALL)
        
        # Check if JSON content was found
        if json_content is None:
            raise ValueError("Invalid input format: Could not find JSON content in the input string.")
        
        # Extract the JSON string and parse it
        json_string = json_content.group(1)
        
        try:
            file_paths = json.loads(json_string)  # Step 2: Parse JSON into list
        except json.JSONDecodeError:
            raise ValueError("Invalid JSON format in the extracted string.")
        
        # Step 3: Read the content of each file based on the parsed list
        files_content = self.read_files(file_paths)

        # Step 4: Format the prompt with the user request, knowledge base, and file content
        prompt = self.PROMPT_TEMPLATE.format(
            msg=msg,
            knowledge_base=json.dumps(knowledge_base, indent=2),
            file_contents=json.dumps(files_content, indent=2)  # Format the file contents as JSON for the prompt
        )

        # Step 5: Ask the AI to generate the code changes
        rsp = await self._aask(prompt)

        return rsp  # Return the dictionary with file paths and their updated content

    def read_files(self, file_paths: list) -> dict:
        """
        Read the content of the specified files from the list of file paths.
        Return them as a dictionary where the key is the file path, and the value is the file content.
        """
        files_data = {}
        for path in file_paths:
            full_path = '/Users/jessiejia/24FA/truman_2023/' + path  # Prepend base path

            # Check if the file exists before trying to read it
            if os.path.exists(full_path):
                with open(full_path, 'r') as file:
                    content = file.read()
                    files_data[path] = content  # Use path as key and content as value
            else:
                files_data[path] = f"(File not found: {path})"  # Store file not found message in dictionary

        # Return the dictionary of file contents
        return files_data


from metagpt.roles import Role

class Developer(Role):
    profile: str = "Developer"

    def __init__(self, context, msg: str, knowledge_base: dict, file_identifier_result: str, **kwargs):
        super().__init__(context=context, **kwargs)
        self.msg = msg
        self.knowledge_base = knowledge_base
        self.file_identifier_result = file_identifier_result  # This is a JSON string of file paths
        self.set_actions([WriteCode])

    async def _act(self):
        # Check if actions are properly initialized
        if not self.actions:
            raise ValueError("No actions have been set for this role.")
        
        # Initialize the WriteCode action
        write_code_action = self.actions[0]

        # Call the WriteCode action's run method with the necessary inputs
        result = await write_code_action.run(
            msg=self.msg,
            knowledge_base=self.knowledge_base,
            file_identifier_result=self.file_identifier_result  # Pass the JSON string of file paths
        )

        return result
