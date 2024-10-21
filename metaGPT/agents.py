import asyncio
from metagpt.actions import Action
from metagpt.logs import logger
from metagpt.context import Context

from SpecWriter import SpecWriter
from ProjectManager import ProjectManager
from TechLead import TechLead
from FileIdentifier import FileIdentifier
from Developer import Developer
# from FileUpdater import FileUpdater


async def run_agents(msg: str):
    # Initialize context for the agents
    context = Context()

    # Initialize Project Manager and Spec Writer

    #TODO: make a changefile agent for each developer result?
    pm = ProjectManager(context=context)
    spec_writer = SpecWriter(context=context)
    tech_lead = TechLead(context=context)
    file_identifier = FileIdentifier(context=context)
    developer = Developer(context = context)
    # file_updater = FileUpdater(context = context)

    # Log initial user message
    logger.info(f"User request: {msg}")

    # Run Project Manager analysis
    pm_result = await pm.run(msg)
    logger.info(f"Project Manager result: {pm_result}")

    # Run Spec Writer based on the PM's output
    spec_writer_result = await spec_writer.run(pm_result)
    logger.info(f"Spec Writer result: {spec_writer_result}")

    tech_lead_result = await tech_lead.run(spec_writer_result)
    logger.info(f"Tech Lead result: {tech_lead_result}")

    file_identifier_result = await file_identifier.run(tech_lead_result)
    logger.info(f"File Identifier result: {file_identifier_result}")

    developer_result = await developer.run(file_identifier_result)
    logger.info(f"Developer result: {developer_result}")

    # file_updater_result = await file_updater.run(developer_result)
    # logger.info(f"file_updater_result: {file_updater_result}")
    


if __name__ == '__main__':
    # Define the user message / requirement
    msg = """
    For each actor post, add a box above the comment box. The box should include a feeling prompt question: “How is Jane Done feeling?” where the name "Jane Doe" is customized by the original poster's name. 
    """
    
    # Run the event loop for agents
    asyncio.run(run_agents(msg))