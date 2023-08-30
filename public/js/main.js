//Before Page load:
$('#content').hide();
$('#loading').show();
// const inactiveThreshold = 60000; //60 seconds 

// function resetActiveTimer() {
//     if (isActive) {
//         var currentTime = new Date();
//         var activeDuration = currentTime - window.sessionStorage.getItem('activeStartTime');
//         if (window.location.pathname !== '/login' && window.location.pathname !== '/signup' && window.location.pathname !== '/forgot') {
//             $.post("/pageTimes", {
//                 time: activeDuration,
//                 _csrf: $('meta[name="csrf-token"]').attr('content')
//             })
//         }
//         isActive = false;
//     }
// }

$(window).on("load", function() {
    // null if it is a new session (https://developer.mozilla.org/en-US/docs/Web/API/Window/sessionStorage) 
    // if (window.sessionStorage.getItem('isActive') === null) {
    //     window.sessionStorage.setItem('isActive', false);
    //     window.sessionStorage.setItem('totalActiveTime', 0);
    // }

    // let timeout = null;
    // //Definition of an active user: mouse movement, clicks etc. If they haven't done it in 1 minute, we stop the timer and record the time.
    // $('#pagegrid').on('mousemove click mouseup mousedown keydown keypress keyup mouseenter scroll resize dblclick mousewheel', function() {
    //     //If there hasn't been a "start time" for activity, set it.We use session storage so we can track activity when pages changes too.
    //     if (window.sessionStorage.getItem('isActive') == 'false') {
    //         window.sessionStorage.setItem('activeStartTime', Date.now());
    //     }
    //     window.sessionStorage.setItem('isActive', true);
    //     clearTimeout(timeout);
    //     timeout = setTimeout(function() {
    //         console.log('Mouse idle for 60 sec');
    //         resetActiveTimer();
    //     }, inactiveThreshold);
    // });

    //Update the active time every second
    // setInterval(function() {
    //     if (window.sessionStorage.getItem('isActive') == 'true') {
    //         var currentTime = new Date();
    //         var timeSinceLastMove = currentTime - window.sessionStorage.getItem('activeStartTime');

    //         if (timeSinceLastMove >= inactiveThreshold) {
    //             resetActiveTimer();
    //         }
    //     }
    //     console.log("Total active time (ms):", totalActiveTime);
    // }, 1000);

    //add humanized time to all posts
    $('.right.floated.time.meta, .date').each(function() {
        const ms = parseInt($(this).text(), 10);
        const time = new Date(ms);
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
    $('.checkbox').checkbox();

    if (window.location.pathname !== '/login' && window.location.pathname !== '/signup' && window.location.pathname !== '/forgot') {
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
            let reader = new FileReader();
            reader.onload = function(e) {
                $('#imgInp').attr('src', e.target.result);
            }
            reader.readAsDataURL(input.files[0]);
        }
    }

    $("#picinput").change(function() {
        readURL(this);
    });

    //Edit button
    $('.ui.editprofile.button').on('click', function() {
        window.location.href = '/account';
    });

    // Track how long a post is on the screen (borders are defined by image)
    // Start time: When the entire photo is visible in the viewport.
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
    // resetActiveTimer();
});