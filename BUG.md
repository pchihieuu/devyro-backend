## Mô tả:
Khi user A(Phan Chí Hiếu thực hiện tạo group thành công (group bao gồm 3 users) và ) tiến hành chat, gửi đi 1 tin nhắn ví dụ tin 1: Hello (thì user Test Hieu 1 nhận được nhắn Hello), sau đó user A thực hiện nhắn thêm tin tiếp theo là 'Tôi là admin' thì user Test Hieu 1 không nhận được, t click lại ô khung chat của group nó mới nhảy hiện lên. Tương tự user C cũng gặp trường hợp tương tự vậy, có một số tin nhắn hiển thị real time trong khung chat, có một số tin không hiện trên mục tin nhắn, đối với user B khi gửi bất kỳ tin nhắn nào cũng sẽ hiển thị bên 2 users còn lại. Điều đó ảnh hưởng đến logic của hệ thống group chat real time cũng như cập nhật tin nhắn cuối cùng của đoạn chat có sự sai sót. 

Khi tôi check database thì tin nhắn đã được ghi vào database nhưng chưa xác định được vấn đề gặp phải ở đâu.

Biết ở devtool có log như sau:
user A (Phan Chi Hieu): Không thấy log
user B (Employ): onNewMessage] received
[onNewMessage] received f4842ec6-91bb-468a-83a4-7dc7dcba305a for group 478dd48d-733f-4d3f-aacd-c1c584f78c41
GroupChatContext.jsx:320 [onNewMessage] received cd67b92d-b428-4a11-9395-1389866c89b6 for group 478dd48d-733f-4d3f-aacd-c1c584f78c41
GroupChatContext.jsx:320 [onNewMessage] received fa8fe40c-7789-43f2-95af-1d4871340d59 for group 478dd48d-733f-4d3f-aacd-c1c584f78c41
GroupChatContext.jsx:320 [onNewMessage] received e49dc734-b5cf-4eeb-acb4-8c2e966c67d9 for group 478dd48d-733f-4d3f-aacd-c1c584f78c41
GroupChatContext.jsx:320 [onNewMessage] received edbc5c12-c4ba-40c8-9657-665264928cd4 for group 478dd48d-733f-4d3f-aacd-c1c584f78c41
GroupChatContext.jsx:320 [onNewMessage] received 2715c208-7b6a-4c0f-babd-414ec691b5d6 for group 478dd48d-733f-4d3f-aacd-c1c584f78c41
GroupChatContext.jsx:320 [onNewMessage] received 9d436804-1b10-4528-997a-e3cada7ebe70 for group 478dd48d-733f-4d3f-aacd-c1c584f78c41
GroupChatContext.jsx:320 [onNewMessage] received cce01b8b-0198-45d7-a118-551993f65cb1 for group 478dd48d-733f-4d3f-aacd-c1c584f78c41
user C (Test Hieu 1):
[onNewMessage] received edbc5c12-c4ba-40c8-9657-665264928cd4 for group 478dd48d-733f-4d3f-aacd-c1c584f78c41 GroupChatContext.jsx:320:15
[onNewMessage] received 2715c208-7b6a-4c0f-babd-414ec691b5d6 for group 478dd48d-733f-4d3f-aacd-c1c584f78c41 GroupChatContext.jsx:320:15
[onNewMessage] received 9d436804-1b10-4528-997a-e3cada7ebe70 for group 478dd48d-733f-4d3f-aacd-c1c584f78c41 GroupChatContext.jsx:320:15
[onNewMessage] received cce01b8b-0198-45d7-a118-551993f65cb1 for group 478dd48d-733f-4d3f-aacd-c1c584f78c41

#Techstacks:
- Backend: express(typescript), rabbitMQ, postgresql
- Frontend: Reactjs