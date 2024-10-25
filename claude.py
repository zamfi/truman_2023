import os
import json
import anthropic as claude
import argparse
from files_ignore import ignored_files, ignored_directory
from dotenv import load_dotenv

# Set up the Anthropic client
load_dotenv()
ANTHROPIC_KEY = os.environ.get("ANTHROPIC_API_KEY")
client = claude.Anthropic(api_key=ANTHROPIC_KEY)
def list_files_in_directory():
    # Define the list of files and directories to ignore
    files_to_ignore = ignored_files()
    directory_to_ignore = ignored_directory()
    root_dir = os.path.abspath(os.curdir)  # Get the current directory (root directory)
    all_files = []
    
    # Walk through the root directory
    for root, dirs, files in os.walk(root_dir):
        # Modify the dirs in-place to remove any directories we want to ignore
        dirs[:] = [d for d in dirs if d not in files_to_ignore]

        # For each file found, store the path relative to the root directory, unless it's in the ignore list
        for file in files:
            if file not in files_to_ignore:
                relative_path = os.path.relpath(os.path.join(root, file), root_dir)
                direc = relative_path.split('/')[0]
                if direc not in directory_to_ignore:
                    all_files.append(relative_path)
    
    return all_files

def pull_file_contents(files):
    
    file_contents = []
    
    # Loop through all files and print their content
    for file_path in files:
        info = f"=== {file_path} ==="
        
        # Open and print the file contents
        try:
            with open(file_path, 'r') as file:
                # print(file.read())
                data = file.read()
                info += "\n" 
                info += data
        except Exception as e:
            print(f"Could not read file {file_path}: {e}")
        
        file_contents.append(info)

    return file_contents

def identify_necessary_files(file_structure, task):
    """Ask Claude to identify necessary files for the task."""
    message = client.messages.create(
        model="claude-3-opus-20240229",
        max_tokens=1000,
        messages=[
            {
                "role": "user",
                "content": (
                    "Here's the file structure of the repository:\n"
                    f"{file_structure}\n\n"
                    f"Task: {task}\n\n"
                    "Please identify the necessary files for the task"
                )
            }
        ]
    )
    # Extract and return the JSON response containing necessary file paths
    return json.loads(message.messages[0]["content"])

def modify_files(file_info, task):
    """Ask Claude to modify the necessary files to achieve the task."""
    try:
        message = client.messages.create(
            messages=[
                {
                    "role": "user",
                    "content": (
                        f"Here's the content of my repository: \n{file_info}\n"
                        f"Task: {task}\n\n"
                        "Please modify the necessary files to achieve the task. Return the results in this format:\n"
                        "Here are all the changes in the repository:\n\n"
                        "=== /path/to/changed_file1 ===\n"
                        "[content of changed_file1]\n\n"
                        "=== /path/to/changed_file2 ===\n"
                        "[content of changed_file2]\n"
                        "Continue this format for all modified files."
                        "Please ensure that the output is properly formatted with code blocks and newlines for clarity."
                    )
                }
            ],
            model="claude-3-opus-20240229",
            max_tokens=2000
        )
        return message.content
    except Exception as e:
        print(f"Error in modify_files: {e}")
        return None

def split_file_content(content):
    """Splits file content into two halves and saves them."""
    lines = content.splitlines()
    mid_index = len(lines) // 2
    part1 = lines[:mid_index]
    part2 = lines[mid_index:]

    with open('claude_input_1.txt', 'w') as part1_file:
        part1_file.write("\n".join(part1))

    with open('claude_input_2.txt', 'w') as part2_file:
        part2_file.write("\n".join(part2))

    print("File successfully split into part1.txt and part2.txt")

def pretty_print_output(input_file_path, output_file_path):
    # Reading the provided text file
    with open(input_file_path, 'r') as file:
        content = file.read()

    # Step 1: Clean up the text, removing unnecessary parts
    cleaned_content = content.replace("TextBlock(text=", "").replace("', type='text')", "").strip()

    # Step 2: Split the content by section headings to retain the structure of the file
    sections = cleaned_content.split("===")

    # Step 3: Reformatting each section
    formatted_sections = []
    for section in sections:
        section = section.strip()  # Remove leading/trailing whitespace
        if not section:  # Skip any empty sections
            continue

        # Example of removing unnecessary characters and ensuring the right format is applied
        if ".pug" in section:  # Only process pug files
            section = "=== " + section  # Re-add heading markers
            formatted_sections.append(section)

    # Step 4: Combine all the formatted sections back together
    reformatted_content = "\n\n".join(formatted_sections)

    # Saving the reformatted content back into a text file
    with open(output_file_path, 'w') as file:
        file.write(reformatted_content)

    return output_file_path

def main(split=False):
    # Get the list of files from the repository
    file_information = list_files_in_directory()
    with open('claude_direcs.txt', 'w') as file:
        # Write the string to the file
        file.write("\n".join(file_information))

    files_data = pull_file_contents(file_information)

    file_structure = "\n".join(files_data)

    # Define your task
    task = "If the user is in the experimental group \"empathy:view\" or \"empathy:none\", then for each post, add a grey box above the comment box. The grey box should include a feeling prompt question: 'How is Jane Doe feeling?' where the name \"Jane Doe\" is customized by the original poster's name."

    # Identify the necessary files
    file_structure = "\n\n".join(files_data)

    if split:
        split_file_content(file_structure)
    else:
        with open('claude_input.txt', 'w') as file:
            # Write the string to the file
            file.write(file_structure)

    if file_structure:
        updated_files = modify_files(file_structure, task)
        print("return updated_files")
        updated_files_str = "\n\n".join(str(item).strip() for item in updated_files)
        updated_files_pretty = f"Here are all the changes in the repository:\n\n{updated_files_str}"

        # Output the updated files and their new contents
        with open('claude_output.txt', 'w') as file:
            file.write(updated_files_pretty)
        print("\nUpdates saved to claude_output.txt")
        pretty_print_output('claude_output.txt', 'claude_output_pretty.txt')
    else:
        print("No files were identified as necessary for the task.")

if __name__ == "__main__":
    # Argument parsing for command-line interface
    parser = argparse.ArgumentParser(description="Split file content and update the repository.")
    parser.add_argument(
        "--split", 
        type=bool, 
        default=False, 
        help="Option to split the file content into two parts. Default is 'false'. Use 'true' to enable splitting."
    )

    args = parser.parse_args()

    # Call the main function with the split argument
    main(split=args.split)