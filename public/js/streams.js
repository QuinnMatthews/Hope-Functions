// Populate Streams table with data from the server
function populateStreamsTable() {
    var table = $('#streams-table');
    $.ajax({
        url: './RestreamChannels',
        type: 'GET',
        success: function(data) {
            data.forEach(function(stream) {
                table.row.add([stream.name, stream.platform.name, stream.url, stream.enabled ? 'Enabled' : 'Disabled']);
            });
            table.draw();
        }
    });
}

// On document ready
$(document).ready(function() {
    // Populate Streams table
    populateStreamsTable();

});

