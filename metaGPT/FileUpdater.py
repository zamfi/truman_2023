# import os
# import json
# import logging
# import re
# from metagpt.roles import Role
# from metagpt.actions import Action

# # Setup logger
# logging.basicConfig(level=logging.INFO)
# logger = logging.getLogger(__name__)

# root_directory = "/Users/jessiejia/24FA/truman_2023/"

# class FileUpdater(Action):
#     """
#     FileUpdater writes the modified content to the original file paths, replacing the original files.
#     """
    
#     name: str = "FileUpdater"
    
#     async def run(self, dev_outputs: str) -> str:
#         """
#         Updates the original files with the modified content provided in JSON format.
        
#         :param modified_files_json: JSON string containing the file paths and their corresponding modified content.
#         :return: A message indicating success or failure for each file update.
#         """
#         # Step 1: Extract and clean the JSON part from the input
#         for dev in eval(dev_outputs):

#             json_content = self.extract_json(dev)
            
#             if not json_content:
#                 return "Invalid or missing JSON content."

#             # Step 2: Parse the cleaned JSON
#             try:
#                 modified_files = json.loads(json_content)
#             except json.JSONDecodeError as e:
#                 logger.error(f"Failed to parse JSON input: {e}")
#                 return "Invalid JSON input."
                        
#             # Step 3: Iterate through the files and replace their content
#             for file_info in modified_files:
#                 file_path = file_info.get('filePath')
#                 modified_content = file_info.get('modifiedContent')
                
#                 if file_path and modified_content:
#                     self.write_file(root_directory + file_path[2:], modified_content)
#                     logger.info(f"changed file {root_directory + file_path[2:]}")
#                 else:
#                     logger.warning(f"Missing file path or content for: {file_info}")
        
            
#         return "\n".join(results)

#     def extract_json(self, input_text: str) -> str:
#         """
#         Extracts the JSON part from the input text. It uses regular expressions to identify the JSON block.
        
#         :param input_text: The string containing the JSON block.
#         :return: Extracted JSON string or None if not found.
#         """
#         try:
#             # Use regex to extract content between backticks and braces (for the JSON block)
#             json_part = re.search(r'```json(.*?)```', input_text, re.DOTALL)
#             if json_part:
#                 return json_part.group(1).strip()
#             else:
#                 # Fallback to searching for JSON between brackets
#                 json_part = re.search(r'\[.*?\]', input_text, re.DOTALL)
#                 return json_part.group(0).strip() if json_part else None
#         except Exception as e:
#             logger.error(f"Failed to extract JSON content: {e}")
#             return None

#     def write_file(self, file_path: str, content: str) -> str:
#         """
#         Writes the modified content to the specified file path, replacing the original content.
        
#         :param file_path: Path to the file to be updated.
#         :param content: New content to write to the file.
#         :return: Success or error message.
#         """
#         try:
#             # Ensure the directory exists
#             dir_name = os.path.dirname(file_path)
#             if not os.path.exists(dir_name):
#                 os.makedirs(dir_name)
            
#             # Write the new content to the file
#             with open(file_path, 'w') as f:
#                 f.write(content)
            
#             logger.info(f"Successfully updated {file_path}")
#             return f"Successfully updated {file_path}"
#         except Exception as e:
#             logger.error(f"Failed to update {file_path}: {e}")
#             return f"Error updating {file_path}: {e}"

# import asyncio
# from metagpt.context import Context

# async def main():
#     msg = """
#     [These changes align with the tasks outlined for designing emoji reactions, updating the database schema, developing the UI for the reaction feature, updating backend logic, enhancing the notification system, and testing and integration.

# {
#     "filepath": "integration-tests.js",
#     "description": "Added integration tests for a new feature where each actor post includes a feeling prompt box above the comment box. The tests ensure that the new feature integrates seamlessly with existing functionalities.",
#     "modified_content": "const request = require('supertest');\n\nconst { MongoMemoryServer } = require('mongodb-memory-server');\n\n(async () => {\n  const mongoServer = await MongoMemoryServer.create();\n  const mockMongoDBUri = await mongoServer.getUri();\n  process.env.MONGODB_URI = mockMongoDBUri;\n\n  /* eslint-disable global-require */\n  const app = require('../app');\n  /* eslint-enable global-require */\n\n  describe('GET /', () => {\n    it('should return 200 OK', (done) => {\n      request(app)\n        .get('/')\n        .expect(200, done);\n    });\n  });\n\n  describe('GET /login', () => {\n    it('should return 200 OK', (done) => {\n      request(app)\n        .get('/login')\n        .expect(200, done);\n    });\n  });\n\n  describe('GET /signup', () => {\n    it('should return 200 OK', (done) => {\n      request(app)\n        .get('/signup')\n        .expect(200, done);\n    });\n  });\n\n  describe('GET /forgot', () => {\n    it('should return 200 OK', (done) => {\n      request(app)\n        .get('/forgot')\n        .expect(200, done);\n    });\n  });\n\n  describe('GET /api', () => {\n    it('should return 200 OK', (done) => {\n      request(app)\n        .get('/api')\n        .expect(200, done);\n    });\n  });\n\n  describe('GET /contact', () => {\n    it('should return 200 OK', (done) => {\n      request(app)\n        .get('/contact')\n        .expect(200, done);\n    });\n  });\n\n  describe('GET /api/lastfm', () => {\n    it('should return 200 OK', (done) => {\n      request(app)\n        .get('/api/lastfm')\n        .expect(200, done);\n    });\n  });\n\n  describe('GET /api/twilio', () => {\n    it('should return 200 OK', (done) => {\n      request(app)\n        .get('/api/twilio')\n        .expect(200, done);\n    });\n  });\n\n  describe('GET /api/stripe', () => {\n    it('should return 200 OK', (done) => {\n      request(app)\n        .get('/api/stripe')\n        .expect(200, done);\n    });\n  });\n\n  describe('GET /api/scraping', () => {\n    it('should return 200 OK', (done) => {\n      request(app)\n        .get('/api/scraping')\n        .expect(200, done);\n    });\n  });\n\n  describe('GET /api/lob', () => {\n    it('should return 200 OK', (done) => {\n      request(app)\n        .get('/api/lob')\n        .expect(200, done);\n    });\n  });\n\n  describe('GET /api/upload', () => {\n    it('should return 200 OK', (done) => {\n      request(app)\n        .get('/api/upload')\n        .expect(200, done);\n    });\n  });\n\n  describe('GET /random-url', () => {\n    it('should return 404', (done) => {\n      request(app)\n        .get('/reset')\n        .expect(404, done);\n    });\n  });\n})();"
# }
# 2024-10-19 21:52:01.398 | INFO     | metagpt.utils.cost_manager:update_cost:57 - Total running cost: $0.328 | Max budget: $10.000 | Current cost: $0.037, prompt_tokens: 889, completion_tokens: 928
# Here's the result:
# [
#   {
#     "filePath": "models/Script.js",
#     "description": "Modif",
#     "modifiedContent": "{\n    \"filepath\": \"path/to/your/mongoose/model.js\",\n    \"description\": \"Modified the scriptSchema to include fields for tracking different types of reactions ('love', 'haha', 'wow', 'sad', 'angry') for each post. Additionally, added a prompt for user feelings above the comment box, customized by the original poster's name.\",\n    \"modified_content\": \"const mongoose = require('mongoose');\\nconst Schema = mongoose.Schema;\\n\\nconst scriptSchema = new mongoose.Schema({\\n    postID: Number, // ID of the post (0, 1, 2, 3, ... )\\n    body: { type: String, default: '', trim: true }, // Text (body) of post\\n    picture: String, // Picture (file path) for post\\n    likes: Number, // Indicates the number of likes on the post (randomly assigned in populate.js)\\n    actor: { type: Schema.ObjectId, ref: 'Actor' }, // Actor of post\\n    time: Number, // Indicates when the post was created relative to how much time has passed since the user created their account, in milliseconds\\n\\n    class: { type: String,\\n            default: '', trim: true }, // For experimental use (If blank/null, this post is shown to all users. If defined, this post is shown only to users with the same value for their experimental condition)\\n\\n    // Reaction counts\\n    reactions: {\\n        love: { type: Number, default: 0 },\\n        haha: { type: Number, default: 0 },\\n        wow: { type: Number, default: 0 },\\n        sad: { type: Number, default: 0 },\\n        angry: { type: Number, default: 0 }\\n    },\\n\\n    // Sorted by least recent --> most recent\\n    // List of actor comments on the post\\n    comments: [new Schema({\\n        commentID: Number, // ID of the comment (0, 1, 2, 3, ... )\\n        body: { type: String, default: '', trim: true }, // Text (body) of comment\\n        likes: Number, // Indicates the number of likes on the comment (randomly assigned in populate.js)\\n        actor: { type: Schema.ObjectId, ref: 'Actor' }, // Actor of comment\\n        time: Number, // Indicates when the comment was created relative to how much time has passed since the user created their account, in milliseconds\\n\\n        class: String, // For experimental use (If blank/null, this comment is shown to all users. If defined, this comment is shown only to users with the same value for their experimental condition)\\n\\n        new_comment: { type: Boolean, default: false }, // T/F; indicates if the comment is by the user\\n        liked: { type: Boolean, default: false }, // T/F; indicates if the comment is liked by the user\\n        flagged: { type: Boolean, default: false }, // T/F; indicates if the comment is flagged by the user\\n    }, { versionKey: false })]\\n}, { versionKey: false });\\n\\nconst Script = mongoose.model('Script', scriptSchema);\\nmodule.exports = Script;\"\n}"
#   }

#     """
#     context = Context()
#     role = FileUpdater(context=context)
#     result = await role.run(msg)
    
#     print("Here's the result:\n" + result)

# # Run the main function
# asyncio.run(main())
