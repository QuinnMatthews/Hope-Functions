// Populate Streams table with data from the server
function populateStreamsTable() {
    var table = $('#streams-table');
    var tbody = table.find('tbody');
    $.ajax({
        url: 'https://develop.hope-functions.pages.dev/RestreamChannels', // TODO: Change to your server URL
        type: 'GET',
        success: function(data) {
            data.forEach(function(stream) {
                tbody.append(`
                <tr class="border-b border-blue-gray-200">
                <td class="py-3 px-4">${stream.name}</td>
                <td class="py-3 px-4">${stream.platform.name}</td>
                <td class="py-3 px-4"><a href="${stream.url}" target="_blank" class="font-medium text-blue-600 hover:text-blue-800">View</a></td>
                <td class="py-3 px-4"><input type="checkbox" disabled ${stream.is_live ? 'checked' : ''} class="form-checkbox h-5 w-5 text-blue-600"></td>
              </tr>
                `)
            });
        }
    });
}

// On document ready
$(document).ready(function() {
    // Populate Streams table
    populateStreamsTable();

});

