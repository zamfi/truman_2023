function canContinue() {
    const chosePicture = $('.image.green').length > 0;
    if (chosePicture) {
        $(".ui.big.labeled.icon.button").addClass("green");
        $(".ui.big.labeled.icon.button")[0].scrollIntoView({ behavior: "smooth" });
    }
}

$(window).on("load", async function() {
    $('.ui.big.labeled.icon.button').removeClass('loading disabled');
    // Click a photo
    $('.image').on('click', function() {
        // clear any photos selected 
        $('.image').removeClass("green");
        $(".image i.icon.green.check").addClass("hidden");

        $(this).closest('.image').addClass("green");
        $(this).find('i.icon').removeClass("hidden");

        canContinue();

        if ($('.ui.warning.message').is(":visible")) {
            $('.ui.warning.message').hide();
        }
    })

    $(".ui.big.labeled.icon.button").on('click', function() {
        const chosePicture = $('.image.green').length > 0;

        if (chosePicture) {
            const foodStyle = $('.image.green')[0].id;
            $(this).addClass('loading disabled');
            $.post('/account/interest', {
                    interest: foodStyle,
                    _csrf: $('meta[name="csrf-token"]').attr('content')
                })
                .done(function(json) {
                    if (json["result"] === "success") {
                        window.location.href = '/'
                    }
                });
        } else {
            $('.ui.warning.message').removeClass("hidden");
            $('.ui.warning.message')[0].scrollIntoView({
                behavior: "smooth",
                block: "center"
            });
        }
    });
});