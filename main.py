import fire
import re
import MetaGPT.metagpt as metagpt

from metagpt.actions import Action, UserRequirement
from metagpt.rag.engines import SimpleEngine
from metagpt.team import Team
from metagpt.roles import Role
from metagpt.logs import logger
from metagpt.schema import Message

from metagpt.rag.schema import (
    BM25RetrieverConfig,
    ChromaIndexConfig,
    ChromaRetrieverConfig,
    FAISSRetrieverConfig,
    LLMRankerConfig,
)

from metagpt.const import DOCS_ROOT

FILE_STRUC_PATH = DOCS_ROOT / "file_structure.json"
FILE_DESC_PATH = DOCS_ROOT / "file_descriptions.json"

class AnalzeRequirement(Action):

    PROMPT_TEMPLATE: str = """
    ## Social Scientist Requirement: {requirement}

    ## Format Example: {FORMAT_EXAMPLE}
    ---
    Role: You are a project manager of a web application 'Truman Platform'. You are receiving a requirement from a social scientist with no techical background. Your task is to analyze their requirement and develop a detailed specification for the interface change the social scientist wants to make. This specification intends to clarify with social scientist about their requirement and thus must be very detailed. Remember only focus on requirement clarification, you do not need to care about implementation. Modify your specification based on SpecWriter feedback. Once you hear "OK" from SpecWriter, the specification is clear and correct, output the final specification.
    ATTENTION: Use '##' to SPLIT SECTIONS, not '#'.

    Output concise specification sentences like format example. If the feedback from SpecWriter is clear to answer your clarification question, you don't need to ouput `Clarifications Needed`.
    """

    FORMAT_EXAMPLE: str = """
    ## Detailed Specification: ...
    
    ## Clarifications Needed: ...
    """

    name: str = "AnalzeRequirement"

    async def run(self, requirement: str):
        # logger.info(f"user input: {requirement}")
        prompt = self.PROMPT_TEMPLATE.format(requirement=requirement, FORMAT_EXAMPLE=self. FORMAT_EXAMPLE)

        rsp = await self._aask(prompt)

        return rsp

class ProjectManager(Role):
    name: str = "PM"
    profile: str = "ProjectManager"
    
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.set_actions([AnalzeRequirement])
        self._watch([UserRequirement, WriteSpec])

    async def _act(self) -> Message:
        logger.info(f"{self._setting}: to do {self.rc.todo}({self.rc.todo.name})")
        todo = self.rc.todo

        msg = self.get_memories(k=1) # find the most k recent messages

        result = await todo.run(msg)

        msg = Message(content=result, role=self.profile, cause_by=type(todo))

        return msg

class WriteSpec(Action):

    PROMPT_TEMPLATE: str = """
    ## Context: {context}
    Review the requirement. Input `OK` if you think we can procceed. Otherwise, tell me what's missing or what you'd like to add.
    """

    name: str = "WriteSpec"

    async def run(self, context: str):
        prompt = self.PROMPT_TEMPLATE.format(context=context)
        rsp = await self._aask(prompt)
        return rsp


class SpecWriter(Role):
    name: str = "SW"
    profile: str = "SpecWriter"

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.set_actions([WriteSpec])
        self._watch([AnalzeRequirement])


class RAGEngine:

    def __init__(self):
        self.engine = SimpleEngine.from_docs(
            input_files=[FILE_DESC_PATH, FILE_STRUC_PATH],
            retriever_configs=[FAISSRetrieverConfig(), BM25RetrieverConfig()],
            ranker_configs=[LLMRankerConfig()],
        )
    
    async def run_pipeline(self, question, print_title=True):
        """This example run rag pipeline, use faiss&bm25 retriever and llm ranker, will print something like:

        Retrieve Result:
        0. Productivi..., 10.0
        1. I wrote cu..., 7.0
        2. I highly r..., 5.0

        Query Result:
        Passion, adaptability, open-mindedness, creativity, discipline, and empathy are key qualities to be a good writer.
        """
        if print_title:
            self._print_title("Run Pipeline")

        nodes = await self.engine.aretrieve(question)
        # self._print_retrieve_result(nodes)

        answer = await self.engine.aquery(question)
        self._print_query_result(answer) 

    @staticmethod
    def _print_title(title):
        logger.info(f"{'#'*30} {title} {'#'*30}")

    @staticmethod
    def _print_retrieve_result(result):
        """Print retrieve result."""
        logger.info("Retrieve Result:")

        for i, node in enumerate(result):
            logger.info(f"{i}. {node.text[:10]}..., {node.score}")

        logger.info("")

    @staticmethod
    def _print_query_result(result):
        """Print query result."""
        logger.info("Query Result:")

        logger.info(f"{result}\n")

    async def _retrieve_and_print(self, question):
        nodes = await self.engine.aretrieve(question)
        self._print_retrieve_result(nodes)
        return nodes

class RAGSearch(Action):

    QUESTION: str = """
    ## Requirement: {requirement}

    Review the Human Requirement, What files should be modified?
    """
    name: str = "RAGSearch"

    async def run(self, requirement):
        question = self.QUESTION.format(requirement=requirement)
        # logger.info(f"YOYOYOYO the question is: {question}")
        engine = RAGEngine()
        answer = await engine.run_pipeline(question=question)
        return f"{answer}\n"
        

class TechLead(Role):
    name: str = "TL"
    profile: str = "TechLead"

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.set_actions([RAGSearch])
        self._watch([AnalzeRequirement])


class WriteCode(Action):

    PROMPT_FORMAT: str = """
    ## Implementation plan: {impl_plan}
    ---
    Role: You are a senior software developer. The main goal is to write PEP8 compliant, elegant, modular, easy to read and maintain code based on the TechLead's implementation plan.
    """
    name: str = "WriteCode"

    async def run(self, plan):
        prompt = self.PROMPT_FORMAT.format(impl_plan=plan)
        rsp = await self._aask(prompt)
        return rsp

class Developer(Role):
    name: str = "Dev"
    profile: str = "Developer"

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.set_actions([WriteCode])
        self._watch([RAGSearch])


async def main(
    msg: str = "Add a grey box above each comment box in actor post. The grey box include a feeling prompt question: “How is Jane Done feeling?”. Each prompt was customized by the poster's name. ",
        
    # msg: str = "1. For each post, assign a large view count and a small view count. The large view count value should be a random number between 145 and 203, and the small view count value should be a random number between 6 and 20. 2. If the user is in the experimental group 'view:large', 'none:large', 'view:small' or 'none:small', then at the bottom right of each post (below the picture but above the reply, flag, share, like buttons), display a small check icon and the text 'Seen by #' next to it. The # should be replaced by the post's large view count if the user is in the experimental group 'view:large' or 'none:large' or by post's small view count if the user is in the experimental group 'view:small' or 'none:small'.",
        
    # msg: str = "When a user creates an account, randomly assign them to one of 6 experimental conditions: 'view:large', 'view:small', 'view:none', 'none:large', 'none:small', 'none:none'. This information should not be displayed to the user.",
        
    # msg: str = """
    # After a user signs up for the platform and views the community rules, add a page that allows users to choose 2 cuisines out of a list of 5 (Cajun, Asian, American, Italian, Mexican). Display the text: "Choose 2 cuisines you are interested in for a more personalized newsfeed" above the selection form. Record the user's selection. Only display the posts with labels matching the user's selection in the newsfeed.

    # Posts labeled with the class "Cajun", "Asian", "American", "Italian", "Mexican" should be displayed differently. They should be displayed with a light gray background. The username should have a blue verified check icon to it's right, and below the username should be the text "Sponsored Ad". The timestamp of the post should be replaced with a button "Follow" that when clicked, changes to "Following" with a check mark and follows the original poster. Above the post should be a header that says "Suggested for you" on the left and a close icon on the right. When the close icon is clicked, the post should be hidden. In it's place should be a blank post that says "This post has been hidden". Whether a post has been hidden or not by the user should be recorded. 
    # """,
    investment: float = 20.0,
    n_round: int = 4,
    add_human: bool = True,
):
    logger.info(msg)

    team = Team()
    team.hire(
        [
            ProjectManager(),
            SpecWriter(is_human=add_human),
            TechLead(),
            Developer()
        ]
    )

    team.invest(investment=investment)
    team.run_project(msg)
    await team.run(n_round=n_round)

if __name__ == '__main__':
    fire.Fire(main)