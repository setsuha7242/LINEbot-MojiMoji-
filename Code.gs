//CHANNEL_ACCESS_TOKENを設定
var CHANNEL_ACCESS_TOKEN = 'アクセストークン'; 
var line_endpoint = 'https://api.line.me/v2/bot/message/reply';
//image用'https://api.line.me/v2/bot/message/{messageId}/content';
var master = "管理者ID";
var user = ["ユーザーID管理(Log用)"];
var comment = null;
var reply_messages;
var log_flag = true;
var weather_flag = true;
var follow_flag = true;
var w_user = [];
var f_user = [];
var specification　= "現在の仕様は、\n・日本語を送るとおうむ返し\n・その他の言語を送ると日本語化して返す\n・画像を送ると文字を起こし、返す\n・一部 スタンプに特定メッセージを返す\n・\"天気開始\”と送るとidを保存\n・保存されたidに朝6傾今日と明日の天気 データを送る\n・\"天気停止\"と送るとidを削除\n・ログを保存\n・Follow時とunfollow時の行動\nだよ〜."
function doPost(e) {
  //ユーザーの呼び出し
  var user_follow = DocumentApp.openById("フォローユーザーを管理するGoogle Document");
  var follow_Paragraphs = user_follow.getParagraphs();
  for ( var num_follow =0 ; follow_Paragraphs.length != num_follow ; num_follow++){
    f_user[num_follow] = follow_Paragraphs[num_follow].getText().replace("\n","");
  }
  //天気ユーザーの呼び出し
  var weather = DocumentApp.openById("天気ユーザーを管理するGoogle Document");
  var Paragraphs = weather.getParagraphs();
  for ( var num =0 ; Paragraphs.length != num ; num++){
    w_user[num] = Paragraphs[num].getText().replace("\n","");
  }
  var json = JSON.parse(e.postData.contents).events[0];
  var messages_type;
  if(json.type =="message"){
    switch (json.message.type) {
      case 'text':
        var user_message = json.message.text; 
        trans_text = translate(user_message)//コメントアウトで原文表示
        if(user_message != trans_text){
          comment = "日本語にするよ〜";
          reply_messages = trans_text
          log_flag = false;
          in_log("trans_ja",json.source.userId);
        }
        else{
          reply_messages = user_message;
        }
        if (user_message == "天気開始"){
          for ( var i in w_user){
            if(w_user[i] == json.source.userId ){
              weather_flag = false;
            }
          }
          if(weather_flag) var set_user = weather.appendParagraph(json.source.userId);
          reply_messages = "毎朝６時頃に天気を送るようにしたよ〜\nもし停止したかったら\"天気停止\"ってメッセージしてね";
          log_flag = false;
          in_log("Start_weather",json.source.userId);
        }
        if (user_message == "天気停止"){
          weather = weather.replaceText(json.source.userId,"");
          reply_messages = "天気を送らないようにしたよ〜"
          log_flag = false;
          in_log("Stop_weather",json.source.userId);
        }
        break;
      
      case 'image':
        imageBlob = get_line_content(json.message.id);
        message = ocr(imageBlob)
        comment = "読み上げるよ〜"
        reply_messages = message
        break;
        //スタンプテスト
      case 'sticker':
        packageId = json.message.packageId;
        stickerId = json.message.stickerId;
        reply_messages = "スタンプを受信しました"+"\n"+"スタンプパッケージ:"+packageId+"\n"+"スタンプID"+stickerId;
        break;
      default:
        break;
    }
    //管理者IDからメッセージが送信された場合
    if(json.source.userId == master){
      master_command(json.message.stickerId);
    }
    if(comment == null){
     messages_type = message_1(reply_messages)
    }else {
     messages_type = message_2(comment,reply_messages)
    }
    //log
    if(log_flag){in_log(json.message.type,json.source.userId);}
    //送信
    line_reply(json,messages_type);
  }
  else if(json.type == "follow"){
    //follow時
    comment = "登録ありがとう~\n"
    comment += "\n"+specification
    messages_type = message_1(comment);
    line_reply(json,messages_type);
    in_log("Follow",json.source.userId);
    for ( var i in f_user){
      if(f_user[i] == json.source.userId ){
        follow_flag = false;
      }
    }
    if(follow_flag) var set_user_follow = user_follow.appendParagraph(json.source.userId);
  }
  else if(json.type == "unfollow"){
    //unfollow時
    user_follow = user_follow.replaceText(json.source.userId,"");
    weather = weather.replaceText(json.source.userId,"");
    in_log("unFollow",json.source.userId);
  }
  user_follow.saveAndClose();
  weather.saveAndClose();
}

//アナウンス
function anounce(){
  var user_follow = DocumentApp.openById("フォローユーザーを管理するGoogle Document");
  var follow_Paragraphs = user_follow.getParagraphs();
  for(var i = 0; follow_Paragraphs.length != i; i++ ){
    if(follow_Paragraphs[i].getText() != ""){
      var message = specification;//specificationは仕様を表す
      var to = follow_Paragraphs[i].getText(); 
      push(message,to)
    }
  }
}

//画像を取り出す
function get_line_content(message_id){
  var url = 'https://api.line.me/v2/bot/message/' + message_id + '/content';
  var get_image = UrlFetchApp.fetch(url, {
    'headers' : {
      'Content-Type':'application/json; charset=UTF-8',
      'Authorization': 'Bearer ' + CHANNEL_ACCESS_TOKEN,
    },
    'method'  : 'get'
  });
  var image_blob = get_image.getBlob().getAs("image/png").setName("text.png");
  return image_blob;
}

//画像を文字起こしする
function ocr(imageBlob){
  var resource = {
    title: imageBlob.getName(),
    mimeType: imageBlob.getContentType()
  };
  var options = {
    ocr: true,
  };
  
  var file = Drive.Files.insert(resource, imageBlob, options);
  
  var doc = DocumentApp.openById(file.id);
  var text = doc.getBody().getText().replace("\n", "");
  var res = Drive.Files.remove(file.id);
  
  return text;
}

//1つメッセージを送る
function message_1(message){
  text = [
      {
        "type" : "text",
        "text" : message
      }
    ]
  return text;
}
//2つメッセージを送る
function message_2(message1,message2){
  text = [
    {
      "type" : "text",
      "text" : message1
    },
    {
      "type" : "text",
      "text" : message2
    }
  ]
  return text;
}
//メッセージを送信する
function line_reply(json,message_type){
  var post_data = {
    "replyToken" : json.replyToken,
    "messages" : message_type
  };
  var options = {
    "method" : "post",
    "headers" : {
      'Content-Type':'application/json',
      'Authorization': 'Bearer ' + CHANNEL_ACCESS_TOKEN
    },
    'payload': JSON.stringify(post_data)
  };
  UrlFetchApp.fetch(line_endpoint,options);
}

//翻訳
function translate(text) {
  var from = "";
  //var to = "en";
  var to = "ja";
  var result = LanguageApp.translate(text, from, to);
  return result;
}

//ログに追加する
function in_log(messages_type,user_id){
  var doc = DocumentApp.openById("ログを保存するGoogle Document");
  var time = new Date();
  //var  month = ("0"+(time.getMonth() + 1)).slice(-2);
  var time_log = "["+time.getFullYear()+"/"+(("0"+(time.getMonth() + 1)).slice(-2))+"/"+(("0"+time.getDate() ).slice(-2))+"/"+ (("0"+time.getHours() ).slice(-2))+":"+ (("0"+time.getMinutes() ).slice(-2))+ ":"+(("0"+time.getSeconds()).slice(-2)) + "]";
  var text = time_log + "user : "+ user_id;
  var set_doc = doc.appendParagraph( text + " --- message_type : " + messages_type );
  doc.saveAndClose();
}

//管理者権限
function master_command(message){
  if (message == 796551){
    comment = "管理者権限:Log";
    var doc = DocumentApp.openById("ログを保存するGoogle Document");
    var Paragraphs = doc.getParagraphs();
    var out = Paragraphs.splice(-10);
    var log = "\n";
    for ( var num =0 ; out.length != num ; num++){
      var log1 = out[num];
      log += log1.getText().replace("\n","");
      if((out.length -1)!= num) log += "\n";
    }
    log = log.replace("\n", "");
    //var log = log_origin;
    if(log == "") reply_messages = "現在、閲覧可能なログはありません"
    else reply_messages = log;
    log_flag = false;
    doc.saveAndClose();
  }
  if(message == 796540){
    comment = "管理者権限:Weather_User";
    var user_w = DocumentApp.openById("天気ユーザーを管理するGoogle Document");
    var parag = user_w.getParagraphs();
    var log_w = "";
    for ( var num1 =0 ; parag.length != num1 ; num1++){
      if(parag[num1].getText() != ""){
      var log1_w = parag[num1];
      log_w += log1_w.getText().replace("\n","");
      if((parag.length -1)!= num1) log_w += "\n";
      }
    }
    if(log_w == "") reply_messages = "現在、利用中のユーザーはいません"
    else reply_messages = log_w;
    log_flag = false;
    user_w.saveAndClose();
  }
  if(message == 796541){
    comment = "管理者権限：Weather";
    reply_messages = show_weather();
    log_flag = false;
  }
}

//天気(大阪）
function show_weather(){
  var text = ""
  var response = UrlFetchApp.fetch("http://weather.livedoor.com/forecast/webservice/json/v1?city=270000"); //URL+cityID
  //var retw = response.getContentText();
  var json = JSON.parse(response);
  var data = json.forecasts;
  //Logger.log(json["publicTime"]);
  for (var i = 0 ; i < 2; i++){
    var day = data[i].dateLabel + "の天気は, " 
    var weather = data[i].telop + " になる見込みだよ~.\n"
    if(data[i].temperature.min != null){
      var lowTemp = "最低温度:" + data[i].temperature.min.celsius +"℃"}
    else {
       lowTemp = "最低温度:---"}
    if(data[i].temperature.max != null)
      var highTemp = "/最高温度:"+data[i].temperature.max.celsius+"℃"; 
    else {
      highTemp = "/最高温度:---"}
    text += day + weather + lowTemp + highTemp; 
    if(i==0) text += "\n\n"
  }
  return text
}

//Pushメッセージを複数人に送る
function Pushcommand(){
  var list_num = 0;
  var user_ID
  var weather = DocumentApp.openById("天気ユーザーを管理するGoogle Document");
  var Paragraphs = weather.getParagraphs();
  for ( var num =0 ; Paragraphs.length != num ; num++){
    if(Paragraphs[num].getText() != ""){
      user_ID = Paragraphs[num].getText();
      createMessage(user_ID)
    }
  }
}

//Pushメッセージひとつ作成
function createMessage(user) {
  //メッセージを定義する
  message = show_weather();
  return push(message,user);
}

//pushメッセージを作成
function push(text,to) {
//メッセージを送信(push)する時に必要なurlでこれは、皆同じなので、修正する必要ありません。
//この関数は全て基本コピペで大丈夫です。
  var url = "https://api.line.me/v2/bot/message/push";
  var headers = {
    "Content-Type" : "application/json; charset=UTF-8",
    'Authorization': 'Bearer ' + CHANNEL_ACCESS_TOKEN,
  };

  //toのところにメッセージを送信したいユーザーのIDを指定します。(toは最初の方で自分のIDを指定したので、linebotから自分に送信されることになります。)
  //textの部分は、送信されるメッセージが入ります。createMessageという関数で定義したメッセージがここに入ります。
  var postData = {
    "to" : to,
    "messages" : [
      {
        'type':'text',
        'text':text,
      }
    ]
  };

  var options = {
    "method" : "post",
    "headers" : headers,
    "payload" : JSON.stringify(postData)
  };
  return UrlFetchApp.fetch(url, options);
}

//ログシステムの変更時に作動させる関数
function log_change(){
  var doc = DocumentApp.openById("ログを保存するGoogle Document");
  var time = new Date();
  var time_log = "["+time.getFullYear()+"/"+(("0"+(time.getMonth() + 1)).slice(-2))+"/"+(("0"+time.getDate() ).slice(-2))+"/"+ (("0"+time.getHours() ).slice(-2))+":"+ (("0"+time.getMinutes() ).slice(-2))+ ":"+(("0"+time.getSeconds()).slice(-2)) + "]";
  var text = time_log + "___________CHANGE_________LOG_________SYSTEM___________";
  var set_doc = doc.appendParagraph( text );
  doc.saveAndClose();
}