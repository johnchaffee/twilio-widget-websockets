window.onload = function () {
  const urlParams = new URLSearchParams(window.location.search);
  // console.log(`urlParams: ${urlParams}`);
  const mobileParam = urlParams.get("mobile");
  // console.log(`mobileParam: ${mobileParam}`);
  const mobileParamEncoded = encodeURIComponent(urlParams.get("mobile")); // %2B12065551111
  // console.log(`mobileParamEncoded: ${mobileParamEncoded}`);
  const mobileParamDecoded = decodeURIComponent(mobileParam); // +12065551111
  // console.log(`mobileParamDecoded: ${mobileParamDecoded}`);
  let mobile_number = mobileParamDecoded;
  console.log(`URL PARAM MOBILE NUMBER: ${mobile_number}`);

  const host = location.origin;
  // console.log(`HOST: ${host}`);

  const wsHost = host.replace(/^http/, "ws");
  // console.log(`WSHOST: ${wsHost}`);
  const wsClient = new WebSocket(wsHost);

  wsClient.onopen = () => {
    console.log("ON OPEN");
    // console.log("Websocket connected to: " + wsClient.url);
  };

  wsClient.onclose = () => {
    console.log("ON CLOSE");
  };

  // MESSAGE RECEIVED FROM SERVER ->
  wsClient.onmessage = (event) => {
    const messages = JSON.parse(event.data);
    console.log("CLIENT ONMESSAGE");
    console.log(messages);

    if (messages.length > 0) {
      messages.forEach((thisMessage) => {
        // If item is messagecreated and matches selected conversation, render message
        if (
          thisMessage.type == "messageCreated" &&
          thisMessage.mobile_number == mobile_number
        ) {
          renderMessage(thisMessage);
        }
      });
      // If first array item is conversationUpdated, render conversation list from entire array
      if (messages[0].type == "conversationUpdated") {
        renderConversationList(messages);
      }
    }
  };

  function renderMessage(thisMessage) {
    if (thisMessage.direction == "inbound") {
      // MESSAGE RECEIVED
      appendMessage(
        MOBILE_NAME,
        thisMessage.mediaUrl,
        "left",
        thisMessage.body,
        formatDate(thisMessage.date_created)
      );
    } else if (thisMessage.body) {
      // MESSAGE SENT
      appendMessage(
        TWILIO_NAME,
        thisMessage.mediaUrl,
        "right",
        thisMessage.body,
        formatDate(thisMessage.date_created)
      );
    }
  }

  function renderConversationList(messages) {
    let conversationListHTML = "";
    let formattedMobile = "";
    let conversationLink = "";
    messages.forEach((message) => {
      // Extract mobile number from conversation_id
      let thisMobileNumber = message.conversation_id.split(";")[1];
      let badge = "";
      // Display badge count if > 0
      if (message.unread_count > 0) {
        badge = `(${message.unread_count})`;
      }
      formattedMobile = formatMobile(thisMobileNumber);
      conversationLink = `<a href="?mobile=${encodeURIComponent(
        thisMobileNumber
      )}">${formattedMobile} ${badge}</a>`;
      if (thisMobileNumber == mobile_number) {
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
    conversationList.innerHTML = conversationListHTML;
  }

  // Icons made by Freepik from www.flaticon.com
  // const TWILIO_IMG = "https://image.flaticon.com/icons/svg/327/327779.svg";
  // const MOBILE_IMG = "https://image.flaticon.com/icons/svg/145/145867.svg";
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
    messageSend(body, mobile_number);
  });

  // APPEND MESSAGE - Render last message
  function appendMessage(name, img, side, text, date_created) {
    let imgElement = "";
    if (img !== undefined) {
      imgElement = `<div class=""><img src="${img}" alt="${img}" width="100%"></div>`
    }
    const msgHTML = `
  <div class="msg ${side}-msg">
    <!-- <div class="msg-img" style="background-image: url(${img})"></div> -->
    <div class="msg-bubble">
      ${imgElement}
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
    return new Date(date_created).toLocaleTimeString();
  }

  // Display phone number as (###) ###-####
  function formatMobile(mobile_number) {
    if (mobile_number.slice(0, 9) === "messenger") {
      return `<i class="fab fa-facebook-messenger"></i>&nbsp;&nbsp;${mobile_number.slice(
        10
      )}`;
      // return "Messenger";
    } else if (mobile_number.slice(0, 8) === "whatsapp") {
      return `<i class="fab fa-whatsapp"></i>&nbsp;&nbsp;${mobile_number.slice(
        9
      )}`;
      // return "Messenger";
    } else {
      return `<i class="far fa-comment"></i>&nbsp;&nbsp;(${mobile_number.slice(
        2,
        5
      )}) ${mobile_number.slice(5, 8)}-${mobile_number.slice(8, 12)}`;
    }
  }

  // MESSAGE SEND
  function messageSend(body, mobile_number) {
    const apiUrl = host + "/messagesend";
    // console.log("APIURL: " + apiUrl);
    // url encode body params
    const bodyParams = new URLSearchParams({
      body: body,
      mobile_number: mobile_number,
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
        console.log("MESSAGE SEND SUCCESS:");
        console.log(result);
      })
      .catch((error) => {
        console.log("MESSAGE SEND CATCH:");
        console.log(error);
      })
      .finally(() => {
        console.log("MESSAGE SEND FINALLY");
      });
  }

};
