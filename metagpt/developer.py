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

    ### File to change (full content):
    {file_content}

    Based on the user request and the current state of the file provided above, find the specific sections where the changes should be made. Only modify the parts that relate to the user request.

    The output should be a JSON dictionary where:
    - The key is the file path,
    - The value is the updated content of that file based on the user request.

    Make sure to only modify the necessary sections and ensure the overall integrity of the code is preserved.

    Example output:
    ```json
    {{
        "{file_path}": "updated content for {file_path}"
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
        
        # Step 3: Initialize a results dictionary to store individual file changes
        results = {}

        # Process each file separately
        for file_path in file_paths:
            # Read the content of each file based on the parsed list
            file_content = self.read_file(file_path)

            # Step 4: Format the prompt for each file
            prompt = self.PROMPT_TEMPLATE.format(
                msg=msg,
                knowledge_base=json.dumps(knowledge_base, indent=2),
                file_content=json.dumps(file_content, indent=2),  # Format as JSON
                file_path=file_path
            )

            rsp = await self._aask(prompt)

            # Check if `rsp` is not empty or null
            if rsp is None or rsp.strip() == "":
                raise ValueError(f"Empty response from LLM for file {file_path}. Check prompt and LLM connection.")

            try:
                # Store the response in the results dictionary with the file path as the key
                results[file_path] = rsp  # Parse the response as JSON and add to results
            except json.JSONDecodeError:
                raise ValueError(f"Failed to decode LLM response as JSON for file {file_path}: {rsp}")

        return json.dumps(results, indent=2)  # Return the dictionary with file paths and their updated content

    def read_file(self, file_path: str) -> str:
        """
        Read the content of the specified file path.
        Return the file content as a string.
        """
        full_path = '/Users/jessiejia/24FA/truman_2023/' + file_path  # Prepend base path

        # Check if the file exists before trying to read it
        if os.path.exists(full_path):
            with open(full_path, 'r') as file:
                return file.read()
        else:
            return f"(File not found: {file_path})"


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
