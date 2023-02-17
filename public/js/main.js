//Before Page load:
$('#content').hide();
$('#loading').show();

$(window).on("load", function() {
    //close loading dimmer on load
    $('#loading').hide();
    $('#content').attr('style', 'block');
    $('#content').fadeIn('slow');
    //Semantic UI: closes messages from flash message
    $('.message .close').on('click', function() {
        $(this).closest('.message').transition('fade');
    });

    //check bell display (and make red if there are notifications)
    if (!(top.location.pathname === '/login' || top.location.pathname === '/signup')) {
        $.getJSON("/bell", function(json) {
            if (json.result) {
                $("i.big.alarm.icon").replaceWith('<i class="big icons"><i class="red alarm icon"></i><i class="corner yellow lightning icon"></i></i>');
            }
        });
    }

    //make checkbox work
    $('.ui.checkbox')
        .checkbox();

    $('.ui.tiny.post.modal').modal({
        observeChanges: true
    });

    //get add new feed post modal to work
    $("#newpost, a.item.newpost").click(function() {
        $('.ui.tiny.post.modal').modal('show');
    });

    //new post validator (picture and text can not be empty)
    $('#postform')
        .form({
            on: 'blur',
            fields: {
                body: {
                    identifier: 'body',
                    rules: [{
                        type: 'empty',
                        prompt: 'Please add some text about your meal.'
                    }]
                },
                picinput: {
                    identifier: 'picinput',
                    rules: [{
                        type: 'notExactly[/public/photo-camera.svg]',
                        prompt: 'Please click on the Camera Icon to add a photo.'
                    }]
                }
            },
            onSuccess: function(event, fields) {
                $("#postform")[0].submit();
            }

        });

    $('#postform').submit(function(e) {
        e.preventDefault();
    });

    //Picture Preview on Image Selection
    function readURL(input) {
        if (input.files && input.files[0]) {
            var reader = new FileReader();
            reader.onload = function(e) {
                $('#imgInp').attr('src', e.target.result);
            }
            reader.readAsDataURL(input.files[0]);
        }
    }

    $("#picinput").change(function() {
        readURL(this);
    });

    //add humanized time to all posts
    $('.right.floated.time.meta, .date').each(function() {
        var ms = parseInt($(this).text(), 10);
        let time = new Date(ms);
        $(this).text(humanized_time_span(time));
    });

    //Button to go to feed
    $('.ui.big.green.labeled.icon.button.feed').on('click', function() {
        window.location.href = '/';
    });

    //Edit button
    $('.ui.editprofile.button').on('click', function() {
        window.location.href = '/account';
    });

    //this is the REPORT User button
    $('button.ui.button.report').on('click', function() {
        var username = $(this).attr("username");
        $('.ui.small.report.modal').modal('show');
        $('.coupled.modal').modal({
            allowMultiple: false
        });
        // attach events to buttons
        $('.second.modal').modal('attach events', '.report.modal .button');
        // show first now
        $('.ui.small.report.modal').modal('show');
    });

    //Report User Form
    $('form#reportform').submit(function(e) {
        e.preventDefault();
        $.post($(this).attr('action'), $(this).serialize(), function(res) {
            // Do something with the response `res`
            //console.log(res);
            // Don't forget to hide the loading indicator!
        });
        //return false; // prevent default action
    });

    $('.ui.home.inverted.button').on('click', function() {
        window.location.href = '/';
    });

    //this is the Block User button
    $('button.ui.button.block').on('click', function() {
        var username = $(this).attr("username");
        //Modal for Blocked Users
        $('.ui.small.basic.blocked.modal')
            .modal({
                closable: false,
                onDeny: function() {
                    //report user

                },
                onApprove: function() {
                    //unblock user
                    $.post("/user", { unblocked: username, _csrf: $('meta[name="csrf-token"]').attr('content') });
                }
            })
            .modal('show');
        //console.log("***********Block USER "+username);
        $.post("/user", { blocked: username, _csrf: $('meta[name="csrf-token"]').attr('content') });

    });

    //Block Modal for User that is already Blocked
    $('.ui.on.small.basic.blocked.modal').modal({
            closable: false,
            onDeny: function() {
                //report user
            },
            onApprove: function() {
                //unblock user
                var username = $('button.ui.button.block').attr("username");
                $.post("/user", { unblocked: username, _csrf: $('meta[name="csrf-token"]').attr('content') });
            }
        })
        .modal('show');

    //this is the "yes" button when responding to the content moderation question
    $('.agree').on('click', function() {});

    //this is the "no" button when responding to the content moderation question
    $('.disagree')
        .on('click', function() {});

    //this is the "view policy" button after responding to the content moderation question
    $('.modInfo')
        .on('click', function() {});

    //this is the "no, don't view policy" button after responding to the content moderation question
    $('.noModInfo')
        .on('click', function() {});

    //adding animations to the moderation comment
    $('.ui.info.message').visibility({
        once: false,
        continuous: false,
        observeChanges: true,
        //throttle:100,
        initialCheck: true,

        onBottomVisible: function(calculations) {
            if ($(this).is(':visible')) {
                $(this).transition('pulse');
            }
        }
    });

    //////TESTING
    $('.ui.fluid.card .img.post')
        .visibility({
            once: false,
            continuous: false,
            observeChanges: true,
            //throttle:100,
            initialCheck: true,

            //handling scrolling down like normal
            onBottomVisible: function(calculations) {
                var startTime = Date.now();
                $(this).siblings(".content").children(".myTimer").text(startTime);
                if (calculations.topVisible) { //then we are scrolling DOWN normally and this is the START time
                    $(this).siblings(".content").children(".myTimer").text(startTime);
                } else { //then we are scrolling UP and this event does not matter!
                }
            },

            onTopPassed: function(calculations) {
                var endTime = Date.now();
                var startTime = parseInt($(this).siblings(".content").children(".myTimer").text());
                var totalViewTime = endTime - startTime; //TOTAL TIME HERE
                //POST HERE
                var parent = $(this).parents(".ui.fluid.card");
                var postID = parent.attr("postID");
                //console.log(postID);
                //Don't record it if it's longer than 24 hours, do this check because refresh causes all posts to be marked as "viewed" for 49 years.(???)
                if (totalViewTime < 86400000) {
                    $.post("/feed", {
                        postID: postID,
                        viewed: totalViewTime,
                        _csrf: $('meta[name="csrf-token"]').attr('content')
                    });
                }
                //console.log("Total time: " + totalViewTime);
                //console.log($(this).siblings(".content").children(".description").text());
            },
            //end handling downward scrolling

            //handling scrolling back upwards
            onTopPassedReverse: function(calculations) {
                var startTime = Date.now();
                $(this).siblings(".content").children(".myTimer").text(startTime);
            },

            onBottomVisibleReverse: function(calculations) {
                if (calculations.bottomPassed) {

                } else {
                    //eND TIME FOR SCROLLING UP
                    var endTime = Date.now();
                    var startTime = parseInt($(this).siblings(".content").children(".myTimer").text());
                    var totalViewTime = endTime - startTime; //TOTAL TIME HERE
                    //POST HERE
                    var parent = $(this).parents(".ui.fluid.card");
                    var postID = parent.attr("postID");
                    //console.log("PostID: " + postID);
                    //console.log(postID);
                    //Don't record it if it's longer than 24 hours, do this check because refresh causes all posts to be marked as "viewed" for 49 years. (???)
                    if (totalViewTime < 86400000) {
                        $.post("/feed", {
                            postID: postID,
                            viewed: totalViewTime,
                            _csrf: $('meta[name="csrf-token"]').attr('content')
                        });
                    }
                    //console.log("Total time: " + totalViewTime);
                    //console.log($(this).siblings(".content").children(".description").text());
                }
                //end handling scrolling back updwards
            }
        });
});