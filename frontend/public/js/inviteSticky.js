const inviteButtons = document.querySelectorAll(".inviteButton");

const overlay = document.querySelector("#overlay");
const inviteSticky = document.querySelector("#inviteSticky");
const userSearchInput = document.querySelector("#userSearchInput");
const userSearchData = document.querySelector("#userSearchData");

function getEventId() {
    // Get the full URL from the browser's address bar
    const fullURL = window.location.href;

    // Split the URL by "/" to get an array of segments
    const urlSegments = fullURL.split('/');

    // Find the index of "events" in the array
    const eventIndex = urlSegments.indexOf('events');

    if (eventIndex !== -1 && eventIndex + 1 < urlSegments.length) {
        // Get the event ID from the next segment
        const eventId = urlSegments[eventIndex + 1];
        console.log('Event ID:', eventId);

        return eventId;
        // Now you can use the event ID in your script
    } else {
        console.log('Event ID not found in the URL.');
    }
}

async function showInviteSticky() {

overlay.classList.remove("d-none");
inviteSticky.classList.remove("d-none");
   
}


function hideSticky() {

    overlay.classList.add("d-none");

    inviteSticky.classList.add("d-none");
    userSearchData.innerHTML = '';
    userSearchInput.value = '';

}

for(let b of inviteButtons) {

    b.addEventListener("click", showInviteSticky);

}

userSearchInput.addEventListener("input", async () => {
    try {

        // Clear previous data
        userSearchData.innerHTML = '';

        if (userSearchInput.value != "") {

            const response = await fetch(`/users?q=${userSearchInput.value}&e=${getEventId()}`);
            const data = await response.json();

            // Display new data
            for (let u of data) {

                // parent row
                const row = document.createElement("div");
                row.setAttribute("class", "row mt-2 mb-4 col-12")

                // img div
                const pictureDiv = document.createElement("div");
                pictureDiv.setAttribute("class", "col-3 col-lg-2");

                const img = document.createElement("img");
                img.setAttribute("style", "height: 48px;");
                img.setAttribute("class", "img-thumbnail rounded-circle d-block mx-auto");
                img.setAttribute("src", "https://static.vecteezy.com/system/resources/thumbnails/020/765/399/small/default-profile-account-unknown-icon-black-silhouette-free-vector.jpg");

                pictureDiv.appendChild(img);

                // username div
                const nameDiv = document.createElement("div");
                nameDiv.setAttribute("class", "col-6 col-lg-7")

                const displayName = document.createElement('h3');
                displayName.setAttribute("class", "fs-4 mb-0");
                displayName.innerText = `${u.displayName}`;

                const userName = document.createElement('h4');
                userName.setAttribute("class", "fs-6 fst-italic");
                userName.innerText = `@${u.userName}`

                nameDiv.appendChild(displayName);
                nameDiv.appendChild(userName);

                // Button Div
                const buttonDiv = document.createElement('div');
                buttonDiv.setAttribute("class", "col-3 d-flex justify-conten-center align-items-center");

                const form = document.createElement("form");
                form.setAttribute("action", `/events/${getEventId()}/invite?_method=PATCH`);
                form.setAttribute("method", "POST");
                form.setAttribute("class", "col-12");

                const hiddenInput = document.createElement("input");
                hiddenInput.setAttribute("type", "hidden");
                hiddenInput.setAttribute("name", "pendingGuest");
                hiddenInput.setAttribute("value", `${u.userName}`);

                const button = document.createElement("button")
                button.setAttribute("class", "btn btn-primary col-12");
                button.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" 
                                fill="currentColor" class="bi bi-person-add" viewBox="0 0 16 16">
                                <path d="M12.5 16a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm.5-5v1h1a.5.5 0 0 1 0 1h-1v1a.5.5 0 0 1-1 0v-1h-1a.5.5 0 0 1 0-1h1v-1a.5.5 0 0 1 1 0Zm-2-6a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM8 7a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" />
                                <path d="M8.256 14a4.474 4.474 0 0 1-.229-1.004H3c.001-.246.154-.986.832-1.664C4.484 10.68 5.711 10 8 10c.26 0 .507.009.74.025.226-.341.496-.65.804-.918C9.077 9.038 8.564 9 8 9c-5 0-6 3-6 4s1 1 1 1h5.256Z" />
                                </svg>`

                form.appendChild(hiddenInput);
                form.appendChild(button);
                buttonDiv.appendChild(form);

                // Append divs in row
                row.appendChild(pictureDiv);
                row.appendChild(nameDiv);
                row.appendChild(buttonDiv);

                // Append row to data div
                userSearchData.appendChild(row);
            }
        }
    } catch (error) {

        console.error('Error fetching data:', error);

    }
})

overlay.addEventListener("click", hideSticky);
