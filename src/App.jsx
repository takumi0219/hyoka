import { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
import FormPage from './(form)/FormPage.jsx';    
import ProfilePage from './(student)/ProfilePage.jsx';
import "./App.css";

export default function App() {
  const [session, setSession] = useState(null);
  const [currentPage, setCurrentPage] = useState("home");

  useEffect(() => {
    supabase.auth
      .getSession()
      .then(({ data: { session } }) => setSession(session));

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    await supabase.auth.signInWithOAuth({ provider: "google" });
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setCurrentPage("home");
    setSession(null);
  };

  // 初期画面
  if (currentPage === "home") {
    return (
      <div className="home">
        <h2>初期画面</h2>
        <button onClick={() => setCurrentPage("form")}>フォームを開く</button>
        <button
          onClick={() => {
            if (!session) {
              signInWithGoogle();
            } else {
              setCurrentPage("profile");
            }
          }}
        >
          ログイン
        </button>
      </div>
    );
  }

  // フォーム画面
  if (currentPage === "form") {
    return (
      <div>
        <FormPage user={session ? session.user : null} />
      </div>
    );
  }
  // 保存データ表示画面
  if (currentPage === "profile") {
    return (
      <div>
        <p>こんにちは{session?.user?.user_metadata?.name}</p>
        <button onClick={signOut}>サインアウト</button>
        {session && <ProfilePage user={session.user} />}
      </div>
    );
  }

  return null;
}
