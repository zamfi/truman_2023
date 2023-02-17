function likePost(e) {
    let target = $(e.target);
    var label = target.next("a.ui.basic.red.left.pointing.label.count");
    var postID = target.closest(".ui.fluid.card").attr("postID");

    if (target.hasClass("red")) { //Unlike Post
        target.removeClass("red");
        label.html(function(i, val) { return val * 1 - 1 });
        var unlike = Date.now();

        if (target.closest(".ui.fluid.card").attr("type") == 'userPost')
            $.post("/userPost_feed", {
                postID: postID,
                unlike: unlike,
                _csrf: $('meta[name="csrf-token"]').attr('content')
            });
        else
            $.post("/feed", {
                postID: postID,
                unlike: unlike,
                _csrf: $('meta[name="csrf-token"]').attr('content')
            });
    } else { //Like Post
        target.addClass("red");
        label.html(function(i, val) { return val * 1 + 1 });
        var like = Date.now();

        if (target.closest(".ui.fluid.card").attr("type") == 'userPost')
            $.post("/userPost_feed", {
                postID: postID,
                like: like,
                _csrf: $('meta[name="csrf-token"]').attr('content')
            });
        else
            $.post("/feed", {
                postID: postID,
                like: like,
                _csrf: $('meta[name="csrf-token"]').attr('content')
            });
    }
}

function flagPost(e) {
    let target = $(e.target);
    var post = target.closest(".ui.fluid.card.dim");
    var postID = post.attr("postID");
    var flag = Date.now();

    $.post("/feed", {
        postID: postID,
        flag: flag,
        _csrf: $('meta[name="csrf-token"]').attr('content')
    });
    post.find(".ui.dimmer.flag").dimmer({ closable: false }).dimmer('show');
    //repeat to ensure its closable
    post.find(".ui.dimmer.flag").dimmer({ closable: false }).dimmer('show');
}

function likeComment(e) {
    let target = $(e.target);
    var comment = target.parents(".comment");
    var label = comment.find("span.num");

    var postID = target.closest(".ui.fluid.card").attr("postID");
    var commentID = comment.attr("commentID");
    var isUserComment = comment.find("a.author").attr('href') === '/me';

    if (target.hasClass("red")) { //Unlike comment
        target.removeClass("red");
        comment.find("i.heart.icon").removeClass("red");
        target.html('Like');
        label.html(function(i, val) { return val * 1 - 1 });
        var unlike = Date.now();

        if (target.closest(".ui.fluid.card").attr("type") == 'userPost') {
            $.post("/userPost_feed", {
                postID: postID,
                commentID: commentID,
                unlike: unlike,
                isUserComment: isUserComment,
                _csrf: $('meta[name="csrf-token"]').attr('content')
            });
        } else {
            $.post("/feed", {
                postID: postID,
                commentID: commentID,
                unlike: unlike,
                isUserComment: isUserComment,
                _csrf: $('meta[name="csrf-token"]').attr('content')
            });
        }
    } else { //Like comment
        target.addClass("red");
        comment.find("i.heart.icon").addClass("red");
        target.html('Unlike');
        label.html(function(i, val) { return val * 1 + 1 });
        var like = Date.now();

        if (target.closest(".ui.fluid.card").attr("type") == 'userPost')
            $.post("/userPost_feed", {
                postID: postID,
                commentID: commentID,
                like: like,
                isUserComment: isUserComment,
                _csrf: $('meta[name="csrf-token"]').attr('content')
            });
        else
            $.post("/feed", {
                postID: postID,
                commentID: commentID,
                like: like,
                isUserComment: isUserComment,
                _csrf: $('meta[name="csrf-token"]').attr('content')
            });
    }
}

function flagComment(e) {
    let target = $(e.target);
    var comment = target.parents(".comment");
    var postID = target.closest(".ui.fluid.card").attr("postID");
    var commentID = comment.attr("commentID");
    comment.replaceWith(`
        <div class="comment" commentID="${commentID}" style="background-color:black;color:white">
            <h5 class="ui inverted header" style="padding-bottom: 0.5em; padding-left: 0.5em;">
                The admins will review this comment further. We are sorry you had this experience.
            </h5>
        </div>`);
    var flag = Date.now();

    if (target.closest(".ui.fluid.card").attr("type") == 'userPost')
        console.log("Should never be here.")
    else
        $.post("/feed", {
            postID: postID,
            commentID: commentID,
            flag: flag,
            _csrf: $('meta[name="csrf-token"]').attr('content')
        });
}

function addComment(e) {
    let target = $(e.target);
    var text = target.siblings("input.newcomment").val();
    var card = target.parents(".ui.fluid.card");
    var comments = card.find(".ui.comments");
    //no comments area - add it
    if (!comments.length) {
        var buttons = card.find(".three.ui.bottom.attached.icon.buttons")
        buttons.after('<div class="content"><div class="ui comments"></div>');
        var comments = card.find(".ui.comments")
    }
    if (text.trim() !== '') {
        var date = Date.now();
        var ava = target.siblings('.ui.label').find('img.ui.avatar.image');
        var ava_img = ava.attr("src");
        var ava_name = ava.attr("name");
        var postID = card.attr("postID");
        var commentID = user.numComments + 1;

        var mess = `
        <div class="comment" commentID=${commentID}>
            <a class="avatar"><img src="${ava_img}"></a>
            <div class="content"> 
                <a class="author" href="/me">${ava_name}</a>
                <div class="metadata"> 
                    <span class="date">${humanized_time_span(date)}</span>
                    <i class="heart icon"></i> 
                    <span class="num"> 0 </span> Likes
                </div> 
                <div class="text">${text}</div>
                <div class="actions"> 
                    <a class="like" onClick="likeComment(event)">Like</a> 
                </div> 
            </div>
        </div>`;
        $(this).siblings("input.newcomment").val('');
        comments.append(mess);

        if (card.attr("type") == 'userPost')
            $.post("/userPost_feed", {
                postID: postID,
                new_comment: date,
                comment_text: text,
                _csrf: $('meta[name="csrf-token"]').attr('content')
            });
        else
            $.post("/feed", {
                postID: postID,
                new_comment: date,
                comment_text: text,
                _csrf: $('meta[name="csrf-token"]').attr('content')
            });
    }
}

$(window).on('load', () => {
    // ************ Actions on Main Post ***************
    // Focus new comment element if "Reply" button is clicked
    $('.reply.button').on('click', function() {
        let parent = $(this).closest(".ui.fluid.card");
        parent.find("input.newcomment").focus();
    });

    // Press enter to submit a comment
    $("input.newcomment").keyup(function(event) {
        if (event.keyCode === 13) {
            $(this).siblings("i.big.send.link.icon").click();
        }
    });

    //Create a new Comment
    $("i.big.send.link.icon").on('click', addComment);

    //Like/Unlike Post
    $('.like.button').on('click', likePost);

    //Flag Post
    $('.flag.button').on('click', flagPost);

    // ************ Actions on Comments***************
    // Like/Unlike comment
    $('a.like.comment').on('click', likeComment);

    //Flag comment
    $('a.flag.comment').on('click', flagComment);
});