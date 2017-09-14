$(document).ready(function() {
    var id = $('#receiverId').val();

    $('#message').click(function() {
        var message = $.trim($('#msg').val());

        if(message != '') {
            $.post('/message/' + id, {
                message: message,
                id: id
            }, function(data) {
                $('#msg').val('');
            });
        }
    });

    //auto update page per 200ms
    setInterval(function() {
        $('.msg').load(location.href + ' .msg');
    }, 200);
});