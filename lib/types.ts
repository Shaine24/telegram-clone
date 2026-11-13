export type Profile = {
  id: string;
  username: string;
  display_name: string;
  avatar_color: string;
  created_at?: string;
};

export type Chat = {
  id: string;
  is_group: boolean;
  name: string | null;
  peer_id: string | null;
  peer_name: string | null;
  peer_username: string | null;
  peer_color: string | null;
  last_message: string | null;
  last_message_at: string | null;
  last_message_sender: string | null;
  unread_count: number;
};

export type Message = {
  id: string;
  chat_id: string;
  sender_id: string;
  body: string;
  created_at: string;
  pending?: boolean;
};

export type UserResult = {
  id: string;
  username: string;
  display_name: string;
  avatar_color: string;
};
