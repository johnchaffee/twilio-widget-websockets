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
    // Play Audio for incoming and outgoing messages
    if (messages.length === 1 && messages[0].type == "messageCreated") {
      const inboundAudio = new Audio("/images/inboundAudio.mp3");
      const outboundAudio = new Audio("/images/outboundAudio.mp3");
      if (messages[0].direction == "inbound") {
        inboundAudio.play();
      } else if (messages[0].direction == "outbound") {
        outboundAudio.play();
      }
    }
    if (messages.length > 0) {
      messages.forEach((thisMessage) => {
        // If type is messagecreated and matches selected conversation, render message
        if (
          thisMessage.type == "messageCreated" &&
          thisMessage.mobile_number == mobile_number
        ) {
          console.log("APPEND MESSAGE");
          renderMessage(thisMessage);
        }
      });
      // If first array type is conversationUpdated, render conversation list from entire array
      if (messages[0].type != "messageCreated") {
        renderConversationList(messages);
      }
    } else {
      console.log("EMPTY MESSAGE, DO NOTHING");
      console.log(messages.length);
    }
  };

  function renderMessage(thisMessage) {
    if (thisMessage.direction == "inbound") {
      // MESSAGE RECEIVED
      appendMessage(
        MOBILE_NAME,
        thisMessage.media_url,
        "left",
        thisMessage.body,
        formatDate(thisMessage.date_created)
      );
    } else if (thisMessage.body) {
      // MESSAGE SENT
      appendMessage(
        TWILIO_NAME,
        thisMessage.media_url,
        "right",
        thisMessage.body,
        formatDate(thisMessage.date_created)
      );
    }
  }

  function renderConversationList(messages) {
    let conversationListHTML = "";
    let msgerHeaderOptionsHTML = "";
    let formattedMobile = "";
    let conversationLink = "";
    let thisMobileNumber = "";
    let contactName = "";
    messages.forEach((message) => {
      // console.log(message);
      // Extract mobile number from conversation_id
      thisMobileNumber = message.conversation_id.split(";")[1];
      contactName = message.contact_name;
      let badge = "";
      formattedIcon = formatIcon(thisMobileNumber);
      formattedMobile = formatMobile(thisMobileNumber);
      conversationLink = `<a href="?mobile=${encodeURIComponent(
        thisMobileNumber
      )}">${formattedIcon} ${
        contactName != null ? contactName : formattedMobile
      } </a>`;
      // Display badge count if > 0
      if (message.unread_count > 0) {
        badge = `${message.unread_count}`;
        conversationLink =
          `<span class="badge">${badge}</span>` + conversationLink;
      }
      if (thisMobileNumber == mobile_number) {
        // Set background color style for selectedConversation
        conversationListHTML += `
      <div id="${thisMobileNumber}" class="conversation-bubble selectedConversation">
    `;
        //set archive and trash icons at msger-header-options upon conversation change
        msgerHeaderOptionsHTML = `&nbsp;<button class="btn btn-light p-0" onclick="archiveConversationButton('${thisMobileNumber}', 'closed')"><i class="fas fa-archive"></i></button>
        &nbsp;&nbsp;<button class="btn btn-light p-0" onclick="archiveConversationButton('${thisMobileNumber}', 'deleted')"><i class="far fa-trash-alt"></i></button>&nbsp;&nbsp;
      `;
        msgerHeaderOptions.innerHTML = msgerHeaderOptionsHTML;
      } else {
        conversationListHTML += `
      <div id="${thisMobileNumber}" class="conversation-bubble">
    `;
      }
      // add/update contact name icon
      conversationListHTML += `
      ${conversationLink}
      &nbsp;<button class="btn btn-light p-0 float-right" onclick="updateContactPrompt('${thisMobileNumber}')"><i class="fas fa-id-card-alt"></i></button>
      </div>
    `;
    });
    if (messages.length === 1) {
      let existingConversation = document.getElementById(thisMobileNumber);
      if (messages[0].type == "conversationUpdated") {
        console.log("DELETE AND INSERT CONVERSATION");
        if (existingConversation != null) {
          existingConversation.remove();
        }
        conversationList.insertAdjacentHTML("afterbegin", conversationListHTML);
      } else if (messages[0].type == "conversationContactUpdated") {
        console.log("UPDATE CONTACT");
        if (existingConversation != null) {
          existingConversation.outerHTML = conversationListHTML;
        }
      } else if (messages[0].type == "conversationStatusUpdated") {
        console.log("ARCHIVE CONVERSATION");
        if (existingConversation != null) {
          existingConversation.remove();
          // If it's the active conversation, redirect to root
          if (thisMobileNumber == mobile_number) {
            console.log("REDIRECT TO ROOT");
            window.location = "./";
          }
        }
      }
    } else {
      console.log("CONVERSATIONS > 1: UPDATE ALL");
      conversationList.innerHTML = conversationListHTML;
    }
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
  const msgerHeaderOptions = get(".msger-header-options");

  msgerForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const body = msgerInput.value;
    // const media_url = "https://demo.twilio.com/owl.png";
    const media_url = null;
    if (!body) return;
    msgerInput.value = "";

    // MESSAGE/SEND
    messageSend(body, mobile_number, media_url);
  });

  // APPEND MESSAGE - Render last message
  function appendMessage(name, img, side, text, date_created) {
    let imgElement = "";
    if (img !== undefined && img !== null) {
      imgElement = `<div class=""><img src="${img}" alt="${img}" width="100%"></div>`;
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
    msgerChat.scrollTop += 1500;
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
      return `${mobile_number.slice(10)}`;
    } else if (mobile_number.slice(0, 8) === "whatsapp") {
      return `${mobile_number.slice(9)}`;
    } else {
      return `(${mobile_number.slice(2, 5)}) ${mobile_number.slice(
        5,
        8
      )}-${mobile_number.slice(8, 12)}`;
    }
  }

  // Display channel icon (SMS, WhatsApp, or Facebook Messenger)
  function formatIcon(mobile_number) {
    if (mobile_number.slice(0, 9) === "messenger") {
      return `<i class="fab fa-facebook-messenger"></i>&nbsp;&nbsp;`;
    } else if (mobile_number.slice(0, 8) === "whatsapp") {
      return `<i class="fab fa-whatsapp"></i>&nbsp;&nbsp;`;
    } else {
      return `<i class="far fa-comment"></i>&nbsp;&nbsp`;
    }
  }

  // MESSAGE SEND
  function messageSend(body, mobile_number, media_url) {
    console.log("messageSend()");
    const apiUrl = host + "/messages";
    // console.log("APIURL: " + apiUrl);
    // url encode body params
    const bodyParams = new URLSearchParams({
      body: body,
      mobile_number: mobile_number,
      media_url: media_url,
    });
    console.log(bodyParams);
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
