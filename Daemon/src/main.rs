use std::fmt::format;
use std::{net::SocketAddr};
use std::{env, thread, string};
use async_trait::async_trait;
use ezsockets::Socket;
use gilrs::{Gilrs, Button, Event};
use inputbot::{KeySequence, KeybdKey::*, MouseButton::*};

type SessionID = u16;
type Session = ezsockets::Session<SessionID, ()>;

struct DaemonServer {
    sessions: Vec<Session>,
}

#[derive(Debug)]
struct DaemonEventButton {
    event: Button,
}
impl DaemonEventButton {
    fn to_string(&self) -> String {
        format!("BTN-{:?}", self.event)
    }
}
#[async_trait]
impl ezsockets::ServerExt for DaemonServer {
    type Session = DaemonSession;
    type Params = String;

    async fn accept(
        &mut self,
        socket: Socket,
        address: SocketAddr,
        _args: (),
    ) -> Result<Session, ezsockets::Error> {
        let id = address.port();
        let session = Session::create(|handle| DaemonSession { id, handle }, id, socket);
        self.sessions.push(session.clone());
        Ok(session)
    }

    async fn disconnected(
        &mut self,
        _id: <Self::Session as ezsockets::SessionExt>::ID,
    ) -> Result<(), ezsockets::Error> {
        self.sessions.retain(|session| session.id != _id);
        Ok(())
    }

    async fn call(&mut self, params: Self::Params) -> Result<(), ezsockets::Error> {
        let daemonevent = params;
        self.sessions.iter_mut().for_each(|session| {
            session.text(daemonevent.clone());
        });
        Ok(())
    }
}

struct DaemonSession {
    handle: Session<>,
    id: SessionID,
}

#[async_trait]
impl ezsockets::SessionExt for DaemonSession {
    type ID = SessionID;
    type Args = ();
    type Params = ();

    fn id(&self) -> &Self::ID {
        &self.id
    }

    async fn text(&mut self, text: String) -> Result<(), ezsockets::Error> {
        Ok(())
    }

    async fn binary(&mut self, _bytes: Vec<u8>) -> Result<(), ezsockets::Error> {
        unimplemented!()
    }

    async fn call(&mut self, params: Self::Params) -> Result<(), ezsockets::Error> {
        let () = params;
        Ok(())
    }
}


#[tokio::main]
async fn main() {
    let args: Vec<String> = env::args().collect();
    let mut port = 9113;
    // get --port from args
    args.iter().for_each(|arg| {
        if arg == "--port" {
            // get indexof arg
            let current_index = args.iter().position(|x| x == arg);
            if current_index.is_none() || args[current_index.unwrap() + 1].parse::<u16>().is_err() {
                println!("No port specified, using default port 9113");
                return;
            }
            let next_index = current_index.unwrap() + 1;
            port = args[next_index].parse().unwrap();
            return;
        }
    });
    
    let mut gilrs = Gilrs::new().unwrap();
    println!("Found {} gamepads", gilrs.gamepads().count());
    // Iterate over all connected gamepads
    for (_id, gamepad) in gilrs.gamepads() {
        println!("{} is {:?}", gamepad.name(), gamepad.power_info());
    }

    let mut button_update: Option<Button> = None;
    let (server, _) = ezsockets::Server::create(|_| DaemonServer { sessions: vec![] });
    AKey.bind({
        let server = server.clone();
        move || {
            let daemonevent = DaemonEventButton {
                event: Button::DPadLeft,
            };
            server.call(daemonevent.to_string());
        }
    });
    SKey.bind({
        let server = server.clone();
        move || {
            let daemonevent = DaemonEventButton {
                event: Button::DPadDown,
            };
            server.call(daemonevent.to_string());
        }
    });
    DKey.bind({
        let server = server.clone();
        move || {
            let daemonevent = DaemonEventButton {
                event: Button::DPadRight,
            };
            server.call(daemonevent.to_string());
        }
    });
    WKey.bind({
        let server = server.clone();
        move || {
            let daemonevent = DaemonEventButton {
                event: Button::DPadUp,
            };
            server.call(daemonevent.to_string());
        }
    });
    
    UpKey.bind({
        let server = server.clone();
        move || {
            let daemonevent = DaemonEventButton {
                event: Button::North,
            };
            server.call(daemonevent.to_string());
        }
    });
    LeftKey.bind({
        let server = server.clone();
        move || {
            let daemonevent = DaemonEventButton {
                event: Button::West,
            };
            server.call(daemonevent.to_string());
        }
    });
    RightKey.bind({
        let server = server.clone();
        move || {
            let daemonevent = DaemonEventButton {
                event: Button::East,
            };
            server.call(daemonevent.to_string());
        }
    });
    DownKey.bind({
        let server = server.clone();
        move || {
            let daemonevent = DaemonEventButton {
                event: Button::South,
            };
            server.call(daemonevent.to_string());
        }
    });
    
    // thread::spawn({
    //     let server = server.clone();
    //     move || {
    //         loop {
    //             // Examine new events
    //             while let Some(Event { id, event, time }) = gilrs.next_event() {
    //                 println!("{}: {:?}", id, event);
    //                 active_gamepad = Some(id);
    //             }
        
    //             // You can also use cached gamepad state
    //             if let Some(gamepad) = active_gamepad.map(|id| gilrs.gamepad(id)) {
    //                 if gamepad.is_pressed(Button::South) {
    //                     let daemonevent = DaemonEventButton {
    //                         event: Button::South,
    //                     };

    //                     server.call(daemonevent.to_string());
    //                 }
    //             }
    //         }
    //     }
    // });

    println!("Started Daemon at port: {}", &port);

    thread::spawn(|| {
        inputbot::handle_input_events();
    });
    let errored = ezsockets::tungstenite::run(server.clone(), format!("127.0.0.1:{}", &port), |_socket| async move {
        println!("Client connected to SwiftDawn Daemon.");
        Ok(())
    }).await.unwrap();

    
}
