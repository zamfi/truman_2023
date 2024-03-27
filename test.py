import fire
import re
import MetaGPT.metagpt as metagpt
import asyncio
from metagpt.actions import Action, UserRequirement
from metagpt.rag.engines import SimpleEngine
from metagpt.team import Team
from metagpt.roles import Role
from metagpt.logs import logger
from metagpt.schema import Message

from metagpt.const import DOCS_ROOT
from metagpt.rag.schema import (
    BM25RetrieverConfig,
    ChromaIndexConfig,
    ChromaRetrieverConfig,
    FAISSRetrieverConfig,
    LLMRankerConfig,
)

FILE_STRUC_PATH = DOCS_ROOT / "file_structure.json"
FILE_DESC_PATH = DOCS_ROOT / "file_descriptions.json"


import fire
import re
import MetaGPT.metagpt as metagpt

from metagpt.actions import Action, UserRequirement
from metagpt.rag.engines import SimpleEngine
from metagpt.team import Team
from metagpt.roles import Role
from metagpt.logs import logger
from metagpt.schema import Message
from typing import Optional

from metagpt.const import DOCS_ROOT, DATA_PATH
from metagpt.rag.schema import (
    BM25RetrieverConfig,
    ChromaIndexConfig,
    ChromaRetrieverConfig,
    FAISSRetrieverConfig,
    LLMRankerConfig,
)

class RAGEngine:

    def __init__(self):
        self.engine = SimpleEngine.from_docs(
            input_files=[FILE_DESC_PATH],
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
    Requirement: {requirement}
    Review the Requirement, What files should be modified?
    """
    name: str = "RAGSearch"

    async def run(self, requirement):
        question = self.QUESTION.format(requirement=requirement)
        engine = RAGEngine()
        answer = await engine.run_pipeline(question=question)
        return f"{answer}\n"
        

class TechLead(Role):
    name: str = "TL"
    profile: str = "TechLead"

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.set_actions([RAGSearch, ])
        self._watch([UserRequirement])

# async def main():
#     """RAG pipeline"""
#     e = RAGEngine()
#     await e.run_pipeline()


# if __name__ == "__main__":
#     asyncio.run(main())
    
async def main(
    # msg: str = "Add a grey box above each comment box in actor post. The grey box include a feeling prompt question: “How is Jane Done feeling?”. Each prompt was customized by the poster’s name. ",
    msg: str = "1. For each post, assign a large view count and a small view count. The large view count value should be a random number between 145 and 203, and the small view count value should be a random number between 6 and 20. 2. If the user is in the experimental group 'view:large', 'none:large', 'view:small' or 'none:small', then at the bottom right of each post (below the picture but above the reply, flag, share, like buttons), display a small check icon and the text 'Seen by #' next to it. The # should be replaced by the post's large view count if the user is in the experimental group 'view:large' or 'none:large' or by post's small view count if the user is in the experimental group 'view:small' or 'none:small'.",
    investment: float = 20.0,
    n_round: int = 5,
    add_human: bool = True,
):
    logger.info(msg)

    team = Team()
    team.hire(
        [
            TechLead()
        ]
    )

    team.invest(investment=investment)
    team.run_project(msg)
    await team.run(n_round=n_round)


if __name__ == '__main__':
    fire.Fire(main)
