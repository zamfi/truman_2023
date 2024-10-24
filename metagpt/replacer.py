import re
import json
import os
from metagpt.actions import Action
from metagpt.roles import Role

root_directory = "/Users/jessiejia/24FA/truman_2023/"

class IdentifyChange(Action):
    PROMPT_TEMPLATE: str = """
    ### Input: {developer_output}

    The developer_output contains one or multiple files to be replaced along with the content to be replaced. Identify the file path and the content to be replaced for each file.

    ## Expected Output: The result should contain only a JSON dictionary where each key is a file path and its value is the updated content. Example:

    ```json
    {{
      "file_path1": "file_path1 updated content",
      "file_path2": "file_path2 updated content"
    }}
    ```
    """
    name: str = "IdentifyChange"

    async def run(self, developer_output: str):
        # Prepare the prompt by formatting the template with developer_output
        prompt = self.PROMPT_TEMPLATE.format(developer_output=developer_output)

        # Request a response from the LLM
        rsp = await self._aask(prompt)

        # Extract the JSON part from the LLM response using regex
        json_match = re.search(r'```json\s*(.*?)\s*```', rsp, re.DOTALL)
        if json_match:
            json_data = json_match.group(1)
            try:
                # Load the JSON data into a dictionary
                json_dict = json.loads(json_data)

                # Iterate over each file_path and updated content and apply the update
                for file_path, updated_content in json_dict.items():
                    self.update(file_path, updated_content)

                return f"Changes applied to {len(json_dict)} file(s)."
            except json.JSONDecodeError as e:
                return f"Error decoding JSON: {e}"
        else:
            return "No valid JSON found in the response."

    def update(self, file_path, updated_content):
        full_file_path = os.path.join(root_directory, file_path)

        try:
            # Open the file in write mode to replace the content
            with open(full_file_path, 'w') as file:
                file.write(updated_content)
            print(f"File at {full_file_path} has been successfully updated.")
        
        except FileNotFoundError:
            print(f"Error: File at {full_file_path} not found.")
        except IOError as e:
            print(f"An IOError occurred: {e}")


class Replacer(Role):
    profile: str = "Replacer"

    def __init__(self, context, developer_output: str, **kwargs):
        super().__init__(context=context, **kwargs)
        self.developer_output = developer_output
        self.set_actions([IdentifyChange])

    async def _act(self):
        # Run the IdentifyChange action to apply changes
        identify_change = self.actions[0]
        result = await identify_change.run(developer_output=self.developer_output)
        return result
