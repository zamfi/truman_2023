import re
from metagpt.actions import Action
import json

class FindFile(Action):
    PROMPT_TEMPLATE: str = """
    ### User Request: 
    {msg}

    ### Instructions (Thinking Process):
    1. **Understand the user request**: Start by reading the user’s message to understand what kind of modification or code change is requested.
    2. **Refer to the Knowledge Base**: Analyze the knowledge base to get context on how different features or functionality are implemented. Look for relevant details based on the modification type (e.g., if it's related to posts, notifications, etc.).
    3. **Analyze the File Structure**: Use the file structure to determine where specific functionality is implemented (e.g., controllers for handling logic, models for schema, views for rendering the UI).
    4. **Refer to the File Descriptions**: Use the file descriptions to pinpoint which files are responsible for the functionality that matches the user’s request.
    5. **Identify Multiple Relevant Files**: Since code changes may affect more than one file, identify all files that could be relevant for the change, including models, controllers, or views as needed.
    6. **Output in JSON format**: Provide the output in the format of a JSON list that includes all relevant file paths. You can select more than one file if necessary.

    ### Knowledge Base:
    {knowledge_base}

    ### File Structure:
    {file_structure}

    ### File Descriptions:
    {file_description}

    ### Expected Output:
    Provide a JSON file listing the relevant file paths that should be modified. If multiple files are relevant, include them all. Example output:
    ```json
    [
      "controllers/script.js",
      "models/Script.js"
    ]
    ```
    """

    name: str = "FindFile"

    async def run(self, msg: str, knowledge_base: dict, file_structure: dict, file_description: list):
        # Format the knowledge base, file structure, and descriptions as JSON
        formatted_knowledge_base = json.dumps(knowledge_base, indent=2)
        formatted_file_structure = json.dumps(file_structure, indent=2)
        formatted_file_description = json.dumps(file_description, indent=2)

        # Generate the full prompt with relevant context and thinking steps
        prompt = self.PROMPT_TEMPLATE.format(
            msg=msg,
            knowledge_base=formatted_knowledge_base,
            file_structure=formatted_file_structure,
            file_description=formatted_file_description
        )

        # Call the model with the formatted prompt
        rsp = await self._aask(prompt)
        
        # Return the response, which should be the relevant file paths in JSON format
        return rsp


from metagpt.roles import Role

class FileIdentifier(Role):
    profile: str = "FileIdentifier"

    def __init__(self, context, msg: str, knowledge_base: dict, file_structure: dict, file_descriptions: list, **kwargs):
        super().__init__(context=context, **kwargs)
        self.msg = msg
        self.knowledge_base = knowledge_base
        self.file_structure = file_structure
        self.file_descriptions = file_descriptions
        self.set_actions([FindFile])

    async def _act(self):
        # Initialize the FindFile action
        find_file_action = self.actions[0]

        # Call the FindFile action's run method with necessary inputs
        result = await find_file_action.run(
            msg=self.msg, 
            knowledge_base=self.knowledge_base, 
            file_structure=self.file_structure, 
            file_description=self.file_descriptions
        )

        # Return the result directly (as JSON)
        return result