//Before Page load:
$('#content').hide();
$('#loading').show();

//Called when inactive and when page unloads
//Function calculates duration of activity and adds to sum in the database.
function addPageTime() {
    const startTime = window.sessionStorage.getItem('startDate');
    if (startTime !== 'null' && window.location.pathname !== '/login' && window.location.pathname !== '/signup') {
        const timeDuration = Date.now() - startTime;
        $.post("/pageTimes", {
            time: timeDuration,
            _csrf: $('meta[name="csrf-token"]').attr('content')
        }).then(function() {
            window.sessionStorage.setItem('startDate', 'null');
        }).catch(function(err) {
            console.log(err);
        });

    }
}

$(window).on("load", function() {
    var timeout = null; //Timer used for tracking user activity. Initialized to null. 
    window.sessionStorage.setItem('startDate', 'null');

    //Definition of an active user: mouse movement, clicks etc. If they haven't done it in 1 minute, we stop the timer and record the time.
    $('#pagegrid').on('mousemove click mouseup mousedown keydown keypress keyup submit change mouseenter scroll resize dblclick mousewheel', function() {
        //If there hasn't been a "start time" for activity, set it.We use session storage so we can track activity when pages changes too.
        if (window.sessionStorage.getItem('startDate') == 'null') {
            window.sessionStorage.setItem('startDate', Date.now());
        }
        clearTimeout(timeout);
        timeout = setTimeout(function() {
            console.log('Mouse idle for 60 sec');
            addPageTime();
        }, 60000);
    });

    //add humanized time to all posts
    $('.right.floated.time.meta, .date').each(function() {
        var ms = parseInt($(this).text(), 10);
        let time = new Date(ms);
        $(this).text(humanized_time_span(time));
    });

    //close loading dimmer on load
    $('#loading').hide();
    $('#content').attr('style', 'block');
    $('#content').fadeIn('slow');

    //Semantic UI: function for closing messages
    $('.message .close').on('click', function() {
        $(this).closest('.message').transition('fade');
    });
    //Semantic UI: function to make checkbox work
    $('.ui.checkbox').checkbox();

    if (window.location.pathname !== '/login' && window.location.pathname !== '/signup') {
        $.post("/pageLog", {
            path: window.location.pathname,
            _csrf: $('meta[name="csrf-token"]').attr('content')
        });
        if (window.location.pathname !== '/notifications') {
            setInterval(function() {
                // method to be executed;
                $.getJSON("/notifications", { bell: true }, function(json) {
                    if (json.count != 0) {
                        $("i.big.alarm.icon").replaceWith('<i class="big icons"><i class="red alarm icon"></i><i class="corner yellow lightning icon"></i></i>');
                    }
                });
            }, 5000);
        }
    };

    //Picture Preview on Image Selection (Used for: uploading new post, updating profile)
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

    //Button to go to feed
    $('.ui.big.green.labeled.icon.button.feed, .ui.home.inverted.button').on('click', function() {
        window.location.href = '/';
    });

    //Edit button
    $('.ui.editprofile.button').on('click', function() {
        window.location.href = '/account';
    });

    // Track how long a post is on the screen (borders are defined by image)
    // Start time: When the entire photo is visible in the viewport .
    // End time: When the entire photo is no longer visible in the viewport.
    $('.ui.fluid.card .img.post').visibility({
        once: false,
        continuous: false,
        observeChanges: true,
        //throttle:100,
        initialCheck: true,
        offset: 50,

        //Handling scrolling down like normal
        //Called when bottomVisible turns true (bottom of a picture is visible): bottom can enter from top or bottom of viewport
        onBottomVisible: function(element) {
            var startTime = parseInt($(this).siblings(".content").children(".myTimer").text());
            // Bottom of picture enters from bottom (scrolling down the feed; as normal)
            if (element.topVisible) { // Scrolling Down AND entire post is visible on the viewport 
                // If this is the first time bottom is visible
                if (startTime == 0) {
                    var startTime = Date.now();
                }
            } else { //Scrolling up and this event does not matter, since entire photo isn't visible anyways.
                var startTime = 0;
            }
            $(this).siblings(".content").children(".myTimer").text(startTime);
        },

        //Element's bottom edge has passed top of the screen (disappearing); happens only when Scrolling Up
        onBottomPassed: function(element) {
            var endTime = Date.now();
            var startTime = parseInt($(this).siblings(".content").children(".myTimer").text());
            var totalViewTime = endTime - startTime; //TOTAL TIME HERE

            var parent = $(this).parents(".ui.fluid.card");
            var postID = parent.attr("postID");
            var postClass = parent.attr("postClass");;
            // If user viewed it for less than 24 hours, but more than 1.5 seconds (just in case)
            if (totalViewTime < 86400000 && totalViewTime > 1500 && startTime > 0) {
                $.post("/feed", {
                    postID: postID,
                    viewed: totalViewTime,
                    postClass: postClass,
                    _csrf: $('meta[name="csrf-token"]').attr('content')
                });
                // Reset Timer
                $(this).siblings(".content").children(".myTimer").text(0);
            }
        },

        //Handling scrolling up
        //Element's top edge has passed top of the screen (appearing); happens only when Scrolling Up
        onTopPassedReverse: function(element) {
            var startTime = parseInt($(this).siblings(".content").children(".myTimer").text());
            if (element.bottomVisible && startTime == 0) { // Scrolling Up AND entire post is visible on the viewport 
                var startTime = Date.now();
                $(this).siblings(".content").children(".myTimer").text(startTime);
            }
        },

        // Called when topVisible turns false (exits from top or bottom)
        onTopVisibleReverse: function(element) {
            if (element.topPassed) { //Scrolling Down, disappears on top; this event doesn't matter (since it is when bottom disappears that time is stopped)
            } else { // False when Scrolling Up (the bottom of photo exits screen.)
                var endTime = Date.now();
                var startTime = parseInt($(this).siblings(".content").children(".myTimer").text());
                var totalViewTime = endTime - startTime;

                var parent = $(this).parents(".ui.fluid.card");
                var postID = parent.attr("postID");
                var postClass = parent.attr("postClass");;
                // If user viewed it for less than 24 hours, but more than 1.5 seconds (just in case)
                if (totalViewTime < 86400000 && totalViewTime > 1500 && startTime > 0) {
                    $.post("/feed", {
                        postID: postID,
                        viewed: totalViewTime,
                        postClass: postClass,
                        _csrf: $('meta[name="csrf-token"]').attr('content')
                    });
                    // Reset Timer
                    $(this).siblings(".content").children(".myTimer").text(0);
                }
            }
        }
    });
});

$(window).on("beforeunload", function() {
    // https://developer.mozilla.org/en-US/docs/Web/API/Window/beforeunload_event
    addPageTime();
});