const urlParams = new URLSearchParams(window.location.search);
console.log(`urlParams: ${urlParams}`);
const mobileParam = urlParams.get("mobile");
console.log(`mobileParam: ${mobileParam}`);
const mobileParamEncoded = encodeURIComponent(urlParams.get("mobile")); // %2B12065551111
console.log(`mobileParamEncoded: ${mobileParamEncoded}`);
const mobileParamDecoded = decodeURIComponent(mobileParam); // +12065551111
console.log(`mobileParamDecoded: ${mobileParamDecoded}`);
let mobile = mobileParamDecoded;
console.log(`MOBILE: ${mobile}`);

const host = location.origin;
console.log(`HOST: ${host}`);

const wsHost = host.replace(/^http/, "ws");
console.log(`WSHOST: ${wsHost}`);
const wsClient = new WebSocket(wsHost);

wsClient.onopen = () => {
  console.log("ON OPEN");
  console.log("Websocket connected to: " + wsClient.url);
};

wsClient.onclose = () => {
  console.log("ON CLOSE");
};

// Use Set() to extract unique mobile numbers from messages array
// https://levelup.gitconnected.com/how-to-find-unique-values-by-property-in-an-array-of-objects-in-javascript-50ca23db8ccc
const uniqueMobileNumbersSet = new Set();
// uniqueMobileNumbersSet.add("+12063693826");
// uniqueMobileNumbersSet.add("+12068163598");
// uniqueMobileNumbersSet.add("+12063996576");

// MESSAGE RECEIVED FROM SERVER ->
wsClient.onmessage = (event) => {
  const messages = JSON.parse(event.data);
  console.log("CLIENT ONMESSAGE");
  console.log("EVENT.ORIGIN: " + event.origin);
  // console.log(event);
  // console.log(event.data);
  console.log(messages);
  if (messages.length > 0) {
    console.log("MESSAGES.LENGTH: " + messages.length);
    messages.forEach((thisMessage) => {
      // console.log(thisMessage);
      thisMessage = JSON.parse(thisMessage);
      uniqueMobileNumbersSet.add(thisMessage.mobile);
      // console.log(thisMessage);
      // console.log(thisMessage.direction);
      // console.log(thisMessage.body);
      // Only render messages that are for the selected conversation mobile number
      if (thisMessage.mobile == mobile) {
        renderConversation(thisMessage);
      }
    });
    // msgerInput.value = "";
  }
  // console.log("UNIQUE MOBILE NUMBERS SET:");
  // console.log(uniqueMobileNumbersSet);
  console.log("MOBILE: " + mobile);
  let uniqueMobileNumbers = Array.from(uniqueMobileNumbersSet).reverse();
  console.log("UNIQUE MOBILE NUMBERS:");
  console.log(uniqueMobileNumbers);
  let conversationListHTML = "";
  let formattedMobile = "";
  let conversationLink = "";
  uniqueMobileNumbers.forEach((mobileNumber) => {
    // console.log("APPEND CONVERSATION LIST:");
    // console.log(mobileNumber);
    formattedMobile = formatMobile(mobileNumber);
    conversationLink = `<a href="?mobile=${encodeURIComponent(
      mobileNumber
    )}">${formattedMobile}</a>`;
    if (mobile == mobileNumber) {
      // Set background color style for selectedConversation
      conversationListHTML += `
      <div class="conversation-bubble selectedConversation">
        ${conversationLink}
      </div>
    `;
    } else {
      conversationListHTML += `
      <div class="conversation-bubble">
        ${conversationLink}
      </div>
    `;
    }
  });
  // console.log("CONVERSATION LIST HTML:");
  // console.log(conversationListHTML);
  conversationList.innerHTML = conversationListHTML;
};

function renderConversation(thisMessage) {
  if (thisMessage.direction == "inbound") {
    // MESSAGE RECEIVED
    appendMessage(
      MOBILE_NAME,
      MOBILE_IMG,
      "left",
      thisMessage.body,
      formatDate(thisMessage.date_created)
    );
  } else if (thisMessage.body) {
    // MESSAGE SENT
    appendMessage(
      TWILIO_NAME,
      TWILIO_IMG,
      "right",
      thisMessage.body,
      formatDate(thisMessage.date_created)
    );
  }
}

// Icons made by Freepik from www.flaticon.com
const TWILIO_IMG = "https://image.flaticon.com/icons/svg/327/327779.svg";
const MOBILE_IMG = "https://image.flaticon.com/icons/svg/145/145867.svg";
const TWILIO_NAME = "Twilio";
const MOBILE_NAME = "Mobile";

const msgerForm = get(".msger-inputarea");
const msgerInput = get(".msger-input");
const msgerChat = get(".msger-chat");
const conversationList = get(".conversation-list");

msgerForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const body = msgerInput.value;
  if (!body) return;
  msgerInput.value = "";

  // MESSAGE/SEND
  messageSend(body, mobile);
});

// APPEND MESSAGE - Render last message
function appendMessage(name, img, side, text, date_created) {
  //   Simple solution for small apps
  const msgHTML = `
  <div class="msg ${side}-msg">
    <!-- <div class="msg-img" style="background-image: url(${img})"></div> -->
    <div class="msg-bubble">
      <div class="msg-text">${text}</div>
    </div>
  </div>
  <div class="msg-footer ${side}-msg">${name} • ${date_created}</div>
`;

  msgerChat.insertAdjacentHTML("beforeend", msgHTML);
  msgerChat.scrollTop += 500;
}

// Utils
function get(selector, root = document) {
  return root.querySelector(selector);
}

// Display date_created as hh:mm:ss
function formatDate(date_created) {
  // return `${date_created.slice(11, 13)}:${date_created.slice(14, 16)}:${date_created.slice(17, 19)}`;
  // return (new Date(date_created).toDateString())
  return (new Date(date_created).toLocaleTimeString())
}

// Display phone number as (###) ###-####
function formatMobile(mobile) {
  if (mobile.slice(0, 9) === "messenger") {
    return `<i class="fab fa-facebook-messenger"></i>&nbsp;&nbsp;${mobile.slice(10)}`;
    // return "Messenger";
  } else if (mobile.slice(0, 8) === "whatsapp") {
    return `<i class="fab fa-whatsapp"></i>&nbsp;&nbsp;${mobile.slice(9)}`;
    // return "Messenger";
  } else {
    return `<i class="far fa-comment"></i>&nbsp;&nbsp;(${mobile.slice(
      2,
      5
    )}) ${mobile.slice(5, 8)}-${mobile.slice(8, 12)}`;
  }
}

// MESSAGE SEND
function messageSend(body, mobile) {
  // FETCH
  const apiUrl = host + "/messagesend";
  console.log("APIURL: " + apiUrl);
  // url encode body params
  const bodyParams = new URLSearchParams({
    body: body,
    mobile: mobile,
  });
  const requestOptions = {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: bodyParams,
  };
  fetch(apiUrl, requestOptions)
    .then((response) => response.text())
    // .then((response) => response.json())
    .then((result) => {
      console.log("SUCCESS");
      console.log("result: " + result);
    })
    .catch((error) => {
      console.log("INDEX MESSAGE SEND CATCH:");
      console.log(error);
      // $("#failed-alert").fadeIn("slow");
      // displayJsonResponse(error);
    })
    .finally(() => {
      console.log("FINALLY");
      // $("#submit").attr("disabled", false);
    });
  // END FETCH
}
// END MESSAGE SEND
