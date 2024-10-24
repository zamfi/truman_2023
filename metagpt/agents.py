import asyncio
from metagpt.logs import logger
from metagpt.context import Context

from fileidentifier import FileIdentifier
from developer import Developer
from replacer import Replacer
import json

# from FileUpdater import FileUpdater

KNOWLEDGE_BASE_PATH = "data/knowledge_base.json"
FILE_STRUC_PATH = "data/file_structure.json"
FILE_DESC_PATH = "data/file_descriptions.json"

async def run_agents(msg: str):
    with open(KNOWLEDGE_BASE_PATH, "r") as f:
        knowledge_base = json.load(f)
    with open(FILE_STRUC_PATH, "r") as f:
        file_structure = json.load(f)
    with open(FILE_DESC_PATH, "r") as f:
        file_descriptions = json.load(f)
    
    context = Context()
    
    # file_identifier = FileIdentifier(context=context,msg = msg, knowledge_base = knowledge_base, file_structure=  file_structure, file_descriptions = file_descriptions)
    
    
    # # Log initial user message
    # logger.info(f"User request: {msg}")

    # file_identifier_result = await file_identifier.run(msg)
    # logger.info(f"File Identifier result: {file_identifier_result}")

    # file_identifier_result = """
    # ```json
    # [
    # "views/partials/actorPost.pug"
    # ]
    # ```"""

    # developer = Developer(context = context, msg = msg, knowledge_base = knowledge_base, file_identifier_result = file_identifier_result)

    # developer_result = await developer.run(file_identifier_result)
    # logger.info(f"Developer result: {developer_result}")

    developer_result = """
    ```json
    {
        "views/partials/actorPost.pug": ".ui.fluid.card(postClass=val.class, postID=val.id, type='actor', actor_un = val.actor.username, actor_name = val.actor.profile.name, actor_pic = val.actor.profile.picture)\n  .content\n    .right.floated.time.meta= (user.createdAt.getTime() + val.time)\n    a(href='/user/'+val.actor.username)     \n      img.ui.avatar.image(src='/public/picture.svg', data-src=cdn+\"/profile_pictures/\"+val.actor.profile.picture)\n      span=val.actor.profile.name\n  .content.dimmable(class=val.flagged ? \"dimmed\": \"\")\n    .ui.dimmer.flag(class=val.flagged ? \"active\": \"\")\n      .content\n        .center\n          h2.ui.inverted.icon.header\n            i.red.flag.icon\n            | You've flagged this!\n            h3.ui.inverted.header\n                span=\"The admins will review this post further. We are sorry you had this experience.\"\n          .ui.inverted.unflag.button(tabindex='0')\n            i.flag.icon\n            |  Unflag\n    .img.post.image\n      img(src='/public/picture.svg', data-src=cdn+\"/post_pictures/\"+val.picture, style=\"max-width:100%; width:100%;\")\n    .description=val.body\n    .myTimer.hidden 0\n  .ui.bottom.three.attached.icon.buttons\n    .ui.reply.button(tabindex='0')\n      i.reply.icon\n      |  Reply\n    .ui.flag.button(tabindex='0')\n      i.flag.icon\n      |  Flag\n    .ui.labeled.button(tabindex='0')\n      .ui.like.button(class=val.liked? \"red\": null)\n        i.heart.icon\n        |  Like\n      a.ui.basic.red.left.pointing.label.count=val.likes\n  if val.comments.length > 0\n    .content\n      .ui.comments\n        each comment in val.comments\n          //- Comment is user-made\n          if comment.new_comment\n            .comment(commentID=comment.commentID)\n              a.avatar.image(href='/me')\n                if user.profile.picture\n                  img(src='/user_avatar/'+user.profile.picture)\n                else\n                  img(src=user.gravatar(60))\n              .content\n                a.author(href='/me')=user.profile.name || user.username || user.id\n                .metadata\n                  span.date=(user.createdAt.getTime() + comment.time)\n                  .rating\n                    i.heart.icon(class=comment.liked ? \"red\" : null)\n                    span.num=comment.likes+(comment.liked ? 1 : 0)\n                    |  Likes\n                .text=comment.body\n                .actions\n                  a.like.comment(class=comment.liked ? \"red\" : null ) !{comment.liked ? \"Unlike\" : \"Like\"}\n          //- Else this is a normal comment from the script\n          else\n            .comment(commentID=comment.id)\n              .content(class=!comment.flagged ? \"transition hidden\" : \"\")                           \n                .text(style=\"background-color: black; color: white; padding: 0.2em;\")  You flagged this comment. The admins will review this comment further. We are sorry you had this experience.\n                .actions \n                  a.unflag Unflag\n              a.avatar(href='/user/'+comment.actor.username, class=comment.flagged ? \"transition hidden\" : \"\")                  \n                img(src='/public/picture.svg', data-src=cdn+\"/profile_pictures/\"+comment.actor.profile.picture)\n              .content(class=comment.flagged ? \"transition hidden\" : \"\")\n                a.author(href='/user/'+comment.actor.username)=comment.actor.profile.name\n                .metadata\n                  span.date=(user.createdAt.getTime() + comment.time)\n                  .rating\n                    i.heart.icon(class=comment.liked ? \"red\" : null)\n                    span.num=comment.likes+(comment.liked ? 1 : 0)\n                    |  Likes\n                .text=comment.body\n                .actions\n                  a.like.comment(class=comment.liked ? \"red\" : null ) !{comment.liked ? \"Unlike\" : \"Like\"}\n                  a.flag.comment Flag\n  .extra.content\n    .ui.fluid.left.labeled.right.icon.input\n      .ui.label\n        if user.profile.picture\n          img.ui.avatar.image.small(src='/user_avatar/'+user.profile.picture, name=user.profile.name || user.username || user.id)\n        else\n          img.ui.avatar.image.small(src=user.gravatar(60), name=user.profile.name || user.username || user.id)\n      .ui.form\n        .field \n          textarea.newcomment(type='text', placeholder='Write a Comment' rows='1')\n      i.big.send.link.icon\n    .extra.content\n      .ui.segment\n        p How is #{val.actor.profile.name} feeling?"
    }
    ```

    ### Description of the Change:
    A new segment has been added above the comment box in the `actorPost.pug` file. This segment includes a feeling prompt question that dynamically inserts the name of the actor from the post, asking "How is [Actor Name] feeling?" This change is designed to enhance user engagement by prompting them to consider the emotional state of the actor before commenting.
    """
    replacer = Replacer(context = context, developer_output=developer_result)
    replacer_result = await replacer.run(developer_result)
    logger.info(f"Replacer result: {replacer_result}")





if __name__ == '__main__':
    # Define the user message / requirement
    msg = """
    For each actor post, add a box above the comment box. The box should include a feeling prompt question: “How is Jane Done feeling?” where the name "Jane Doe" is customized by the original poster's name. 
    """
    
    # Run the event loop for agents
    asyncio.run(run_agents(msg))