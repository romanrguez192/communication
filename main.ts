//% block="Comunicacion"
//% color="#ffa500"
//% icon="\uf1eb"
namespace communication {
    radio.setGroup(1);
    radio.setTransmitSerialNumber(true);

    namespace betterRadio {
        const PACKET_SIZE = 16;
        let messageId = 0;

        export function sendString(message: string) {
            if (message.length === 0) {
                const id = String.fromCharCode(messageId);
                const index = String.fromCharCode(0);
                const total = String.fromCharCode(1);
                const segment = "";

                const emptyMessagePacket = `${id}${index}${total}${segment}`;

                radio.sendString(emptyMessagePacket);
                messageId = (messageId + 1) % 256;
                return;
            }

            const totalPackets = Math.ceil(message.length / PACKET_SIZE);

            const packets = [];

            for (let i = 0; i < message.length; i += PACKET_SIZE) {
                const id = String.fromCharCode(messageId);
                const index = String.fromCharCode(i / PACKET_SIZE);
                const total = String.fromCharCode(totalPackets);
                const segment = message.substr(i, PACKET_SIZE);

                const packet = `${id}${index}${total}${segment}`;
                packets.push(packet);
            }

            packets.forEach(function (packet) {
                radio.sendString(packet);
            });

            messageId = (messageId + 1) % 256;
        }

        interface ReceivedPackets {
            [senderId: number]: {
                [messageId: number]: string[];
            };
        }

        const receivedPackets: ReceivedPackets = {};
        const listeners: ((receivedString: string) => void)[] = [];

        radio.onReceivedString(function (receivedString) {
            const senderId = radio.receivedSerial();
            const messageId = receivedString.charCodeAt(0);
            const index = receivedString.charCodeAt(1);
            const total = receivedString.charCodeAt(2);
            const content = receivedString.substr(3);

            if (!receivedPackets[senderId]) {
                receivedPackets[senderId] = {};
            }

            if (!receivedPackets[senderId][messageId]) {
                const packets = [];
                for (let i = 0; i < total; i++) {
                    packets.push(null);
                }
                receivedPackets[senderId][messageId] = packets;
            }

            receivedPackets[senderId][messageId][index] = content;

            let isComplete = true;
            for (const packet of receivedPackets[senderId][messageId]) {
                if (packet === null) {
                    isComplete = false;
                    break;
                }
            }

            if (isComplete) {
                const message = receivedPackets[senderId][messageId].join("");

                for (const listener of listeners) {
                    listener(message);
                }

                delete receivedPackets[senderId][messageId];

                if (Object.keys(receivedPackets[senderId]).length === 0) {
                    delete receivedPackets[senderId];
                }
            }
        });

        // TODO: Standardize naming of variables (receivedString, mensaje, receivedMessage, etc.)
        export function onReceivedString(cb: (receivedString: string) => void) {
            listeners.push(cb);
        }
    }

    enum MessageType {
        Direct,
        DirectEvent,
        Group,
        GroupEvent,
        Broadcast,
        BroadcastEvent,
    }

    interface BaseMessagePacket {
        sender: string;
        data: any;
    }

    interface DirectMessagePacket extends BaseMessagePacket {
        type: MessageType.Direct;
        receiver: string;
    }

    interface DirectEventMessagePacket {
        sender: string;
        type: MessageType.DirectEvent;
        receiver: string;
        event: string;
    }

    interface GroupMessagePacket extends BaseMessagePacket {
        type: MessageType.Group;
        group: string;
    }

    interface GroupEventMessagePacket {
        sender: string;
        type: MessageType.GroupEvent;
        group: string;
        event: string;
    }

    interface BroadcastMessagePacket extends BaseMessagePacket {
        type: MessageType.Broadcast;
    }

    interface BroadcastEventMessagePacket {
        sender: string;
        type: MessageType.BroadcastEvent;
        event: string;
    }

    type MessagePacket =
        | DirectMessagePacket
        | DirectEventMessagePacket
        | GroupMessagePacket
        | GroupEventMessagePacket
        | BroadcastMessagePacket
        | BroadcastEventMessagePacket;

    //% block="establecer canal de comunicacion a $canal"
    //% change.defl=1
    //% canal.min=0 canal.max=255
    //% group="Configuracion"
    //% weight=110
    export function setChannel(canal: number) {
        radio.setGroup(canal);
    }

    let myDeviceName = control.deviceName();

    // TODO: Consider multiple devices with the same name

    //% block="registrar dispositivo con nombre $name"
    //% group="Configuracion"
    //% weight=100
    export function registerDevice(name: string) {
        myDeviceName = name;
    }

    //% block="$device"
    //% blockId=device_field
    //% blockHidden=true shim=TD_ID
    //% device.fieldEditor="autocomplete" device.fieldOptions.decompileLiterals=true
    //% device.fieldOptions.key="devices"
    export function _deviceField(device: string) {
        return device;
    }

    //% block="enviar mensaje $message a $receiver"
    //% message.shadow=text message.defl="hola"
    //% receiver.shadow=device_field receiver.defl="nombre"
    //% group="Mensajes Directos"
    //% weight=100
    export function sendDirectMessage(receiver: string, message: any) {
        const messagePacket: DirectMessagePacket = {
            type: MessageType.Direct,
            sender: myDeviceName,
            data: message,
            receiver,
        };
        betterRadio.sendString(JSON.stringify(messagePacket));
    }

    //% block="al recibir un $mensaje directo de $emisor"
    //% group="Mensajes Directos"
    //% draggableParameters="reporter"
    //% weight=90
    export function onDirectMessageReceived(handler: (mensaje: any, emisor: string) => void) {
        betterRadio.onReceivedString(function (receivedString: string) {
            const messagePacket: MessagePacket = JSON.parse(receivedString);
            if (messagePacket.type === MessageType.Direct && messagePacket.receiver === myDeviceName) {
                handler(messagePacket.data, messagePacket.sender);
            }
        });
    }

    //% block="al recibir un $mensaje directo de $sender"
    //% sender.shadow=device_field
    //% group="Mensajes Directos"
    //% draggableParameters="reporter"
    //% weight=85
    export function onDirectMessageReceivedFrom(sender: string, handler: (mensaje: any) => void) {
        betterRadio.onReceivedString(function (receivedString: string) {
            const messagePacket: MessagePacket = JSON.parse(receivedString);
            if (
                messagePacket.type === MessageType.Direct &&
                messagePacket.receiver === myDeviceName &&
                messagePacket.sender === sender
            ) {
                handler(messagePacket.data);
            }
        });
    }

    //% block="$event"
    //% blockId=event_field
    //% blockHidden=true shim=TD_ID
    //% event.fieldEditor="autocomplete" event.fieldOptions.decompileLiterals=true
    //% event.fieldOptions.key="events"
    export function _eventField(event: string) {
        return event;
    }

    //% block="enviar evento $event a $receiver"
    //% event.defl="evento" receiver.defl="nombre"
    //% receiver.shadow=device_field event.shadow=event_field
    //% group="Eventos Directos"
    //% weight=50
    export function sendDirectEvent(receiver: string, event: string) {
        const messagePacket: DirectEventMessagePacket = {
            type: MessageType.DirectEvent,
            sender: myDeviceName,
            receiver,
            event,
        };
        betterRadio.sendString(JSON.stringify(messagePacket));
    }

    //% block="al recibir un $evento directo de $emisor"
    //% group="Eventos Directos"
    //% draggableParameters="reporter"
    //% weight=40
    export function onDirectEventReceived(handler: (evento: string, emisor: string) => void) {
        betterRadio.onReceivedString(function (receivedString: string) {
            const messagePacket: MessagePacket = JSON.parse(receivedString);
            if (messagePacket.type === MessageType.DirectEvent && messagePacket.receiver === myDeviceName) {
                handler(messagePacket.event, messagePacket.sender);
            }
        });
    }

    //% block="al recibir un $evento directo de $sender"
    //% sender.shadow=device_field
    //% group="Eventos Directos"
    //% draggableParameters="reporter"
    //% weight=30
    export function onDirectEventReceivedFrom(sender: string, handler: (evento: string) => void) {
        betterRadio.onReceivedString(function (receivedString: string) {
            const messagePacket: MessagePacket = JSON.parse(receivedString);
            if (
                messagePacket.type === MessageType.DirectEvent &&
                messagePacket.receiver === myDeviceName &&
                messagePacket.sender === sender
            ) {
                handler(messagePacket.event);
            }
        });
    }

    //% block="al recibir el evento $event directo de $emisor"
    //% event.shadow=event_field
    //% group="Eventos Directos"
    //% draggableParameters="reporter"
    //% weight=20
    export function onDirectEventReceivedWithEvent(event: string, handler: (emisor: string) => void) {
        betterRadio.onReceivedString(function (receivedString: string) {
            const messagePacket: MessagePacket = JSON.parse(receivedString);
            if (
                messagePacket.type === MessageType.DirectEvent &&
                messagePacket.receiver === myDeviceName &&
                messagePacket.event === event
            ) {
                handler(messagePacket.sender);
            }
        });
    }

    //% block="al recibir el evento $event directo de $sender"
    //% sender.shadow=device_field
    //% event.shadow=event_field
    //% group="Eventos Directos"
    //% draggableParameters="reporter"
    //% weight=10
    export function onDirectEventReceivedFromWithEvent(sender: string, event: string, handler: () => void) {
        betterRadio.onReceivedString(function (receivedString: string) {
            const messagePacket: MessagePacket = JSON.parse(receivedString);
            if (
                messagePacket.type === MessageType.DirectEvent &&
                messagePacket.receiver === myDeviceName &&
                messagePacket.sender === sender &&
                messagePacket.event === event
            ) {
                handler();
            }
        });
    }

    // TODO: Consider turning this into a block
    const groupsJoined: string[] = [];

    //% block="$group"
    //% blockId=group_field
    //% blockHidden=true shim=TD_ID
    //% group.fieldEditor="autocomplete" group.fieldOptions.decompileLiterals=true
    //% group.fieldOptions.key="groups"
    export function _groupField(group: string) {
        return group;
    }

    //% block="unirse al grupo $group"
    //% group.shadow=group_field
    //% group="Mensajes de Grupo"
    //% weight=120
    export function joinGroup(group: string) {
        if (groupsJoined.indexOf(group) === -1) {
            groupsJoined.push(group);
        }
    }

    //% block="salir del grupo $group"
    //% group.shadow=group_field
    //% group="Mensajes de Grupo"
    //% weight=110
    export function leaveGroup(group: string) {
        const index = groupsJoined.indexOf(group);
        if (index !== -1) {
            groupsJoined.splice(index, 1);
        }
    }

    //% block="enviar mensaje $message al grupo $group"
    //% message.shadow=text message.defl="hola"
    //% group.shadow=group_field
    //% group="Mensajes de Grupo"
    //% weight=100
    export function sendMessageToGroup(group: string, message: any) {
        if (groupsJoined.indexOf(group) === -1) {
            return;
        }

        const messagePacket: GroupMessagePacket = {
            type: MessageType.Group,
            sender: myDeviceName,
            data: message,
            group,
        };
        betterRadio.sendString(JSON.stringify(messagePacket));
    }

    //% block="al recibir un $mensaje de $emisor en el grupo $group"
    //% group.shadow=group_field
    //% group="Mensajes de Grupo"
    //% draggableParameters="reporter"
    //% weight=90
    export function onReceivedMessageFromGroup(group: string, handler: (mensaje: any, emisor: string) => void) {
        betterRadio.onReceivedString(function (receivedString: string) {
            const messagePacket: MessagePacket = JSON.parse(receivedString);
            if (
                messagePacket.type === MessageType.Group &&
                messagePacket.group === group &&
                groupsJoined.indexOf(group) !== -1
            ) {
                handler(messagePacket.data, messagePacket.sender);
            }
        });
    }

    //% block="al recibir un $mensaje de $sender en el grupo $group"
    //% sender.shadow=device_field
    //% group.shadow=group_field
    //% group="Mensajes de Grupo"
    //% draggableParameters="reporter"
    //% weight=85
    export function onReceivedMessageFromGroupFrom(group: string, sender: string, handler: (mensaje: any) => void) {
        betterRadio.onReceivedString(function (receivedString: string) {
            const messagePacket: MessagePacket = JSON.parse(receivedString);
            if (
                messagePacket.type === MessageType.Group &&
                messagePacket.group === group &&
                groupsJoined.indexOf(group) !== -1 &&
                messagePacket.sender === sender
            ) {
                handler(messagePacket.data);
            }
        });
    }

    //% block="enviar evento $event al grupo $group"
    //% event.defl="evento"
    //% group.shadow=group_field
    //% group="Eventos de Grupo"
    //% weight=60
    export function sendEventToGroup(group: string, event: string) {
        if (groupsJoined.indexOf(group) === -1) {
            return;
        }

        const messagePacket: GroupEventMessagePacket = {
            type: MessageType.GroupEvent,
            sender: myDeviceName,
            group,
            event,
        };
        betterRadio.sendString(JSON.stringify(messagePacket));
    }

    //% block="al recibir un $evento de $emisor en el grupo $group"
    //% group.shadow=group_field
    //% group="Eventos de Grupo"
    //% draggableParameters="reporter"
    //% weight=50
    export function onReceivedEventFromGroup(group: string, handler: (evento: string, emisor: string) => void) {
        betterRadio.onReceivedString(function (receivedString: string) {
            const messagePacket: MessagePacket = JSON.parse(receivedString);
            if (
                messagePacket.type === MessageType.GroupEvent &&
                messagePacket.group === group &&
                groupsJoined.indexOf(group) !== -1
            ) {
                handler(messagePacket.event, messagePacket.sender);
            }
        });
    }

    //% block="al recibir un $evento de $sender en el grupo $group"
    //% sender.shadow=device_field
    //% group.shadow=group_field
    //% group="Eventos de Grupo"
    //% draggableParameters="reporter"
    //% weight=40
    export function onReceivedEventFromGroupFrom(group: string, sender: string, handler: (evento: string) => void) {
        betterRadio.onReceivedString(function (receivedString: string) {
            const messagePacket: MessagePacket = JSON.parse(receivedString);
            if (
                messagePacket.type === MessageType.GroupEvent &&
                messagePacket.group === group &&
                groupsJoined.indexOf(group) !== -1 &&
                messagePacket.sender === sender
            ) {
                handler(messagePacket.event);
            }
        });
    }

    //% block="al recibir el evento $event de $emisor en el grupo $group"
    //% event.shadow=event_field
    //% group.shadow=group_field
    //% group="Eventos de Grupo"
    //% draggableParameters="reporter"
    //% weight=30
    export function onReceivedEventFromGroupWithEvent(group: string, event: string, handler: (emisor: string) => void) {
        betterRadio.onReceivedString(function (receivedString: string) {
            const messagePacket: MessagePacket = JSON.parse(receivedString);
            if (
                messagePacket.type === MessageType.GroupEvent &&
                messagePacket.group === group &&
                groupsJoined.indexOf(group) !== -1 &&
                messagePacket.event === event
            ) {
                handler(messagePacket.sender);
            }
        });
    }

    //% block="al recibir el evento $event de $sender en el grupo $group"
    //% sender.shadow=device_field
    //% event.shadow=event_field
    //% group.shadow=group_field
    //% group="Eventos de Grupo"
    //% draggableParameters="reporter"
    //% weight=20
    export function onReceivedEventFromGroupFromWithEvent(
        group: string,
        sender: string,
        event: string,
        handler: () => void
    ) {
        betterRadio.onReceivedString(function (receivedString: string) {
            const messagePacket: MessagePacket = JSON.parse(receivedString);
            if (
                messagePacket.type === MessageType.GroupEvent &&
                messagePacket.group === group &&
                groupsJoined.indexOf(group) !== -1 &&
                messagePacket.sender === sender &&
                messagePacket.event === event
            ) {
                handler();
            }
        });
    }

    //% block="enviar mensaje $message por difusion"
    //% message.shadow=text message.defl="hola"
    //% group="Mensajes de Difusion"
    //% weight=100
    export function broadcastMessage(message: any) {
        const messagePacket: BroadcastMessagePacket = {
            type: MessageType.Broadcast,
            sender: myDeviceName,
            data: message,
        };
        betterRadio.sendString(JSON.stringify(messagePacket));
    }

    //% block="al recibir un $mensaje de $emisor por difusion"
    //% group="Mensajes de Difusion"
    //% draggableParameters="reporter"
    //% weight=90
    export function onReceivedBroadcast(handler: (mensaje: string, emisor: string) => void) {
        betterRadio.onReceivedString(function (receivedString: string) {
            const messagePacket: MessagePacket = JSON.parse(receivedString);
            if (messagePacket.type === MessageType.Broadcast) {
                handler(messagePacket.data, messagePacket.sender);
            }
        });
    }

    //% block="al recibir un $mensaje de $sender por difusion"
    //% sender.shadow=device_field
    //% group="Mensajes de Difusion"
    //% draggableParameters="reporter"
    //% weight=85
    export function onReceivedBroadcastFrom(sender: string, handler: (mensaje: string) => void) {
        betterRadio.onReceivedString(function (receivedString: string) {
            const messagePacket: MessagePacket = JSON.parse(receivedString);
            if (
                messagePacket.type === MessageType.Broadcast &&
                messagePacket.sender === sender &&
                typeof messagePacket.data === "string"
            ) {
                handler(messagePacket.data);
            }
        });
    }

    //% block="enviar evento $event por difusion"
    //% event.defl="evento"
    //% group="Eventos de Difusion"
    //% weight=60
    export function broadcastEvent(event: string) {
        const messagePacket: BroadcastEventMessagePacket = {
            type: MessageType.BroadcastEvent,
            sender: myDeviceName,
            event,
        };
        betterRadio.sendString(JSON.stringify(messagePacket));
    }

    //% block="al recibir un $evento de difusion de $emisor"
    //% group="Eventos de Difusion"
    //% draggableParameters="reporter"
    //% weight=50
    export function onReceivedEventBroadcast(handler: (evento: string, emisor: string) => void) {
        betterRadio.onReceivedString(function (receivedString: string) {
            const messagePacket: MessagePacket = JSON.parse(receivedString);
            if (messagePacket.type === MessageType.BroadcastEvent) {
                handler(messagePacket.event, messagePacket.sender);
            }
        });
    }

    //% block="al recibir un $evento de difusion de $sender"
    //% sender.shadow=device_field
    //% group="Eventos de Difusion"
    //% draggableParameters="reporter"
    //% weight=40
    export function onReceivedEventBroadcastFrom(sender: string, handler: (evento: string) => void) {
        betterRadio.onReceivedString(function (receivedString: string) {
            const messagePacket: MessagePacket = JSON.parse(receivedString);
            if (messagePacket.type === MessageType.BroadcastEvent && messagePacket.sender === sender) {
                handler(messagePacket.event);
            }
        });
    }

    //% block="al recibir el evento $event de difusion de $emisor"
    //% event.shadow=event_field
    //% group="Eventos de Difusion"
    //% draggableParameters="reporter"
    //% weight=30
    export function onReceivedEventBroadcastWithEvent(event: string, handler: (emisor: string) => void) {
        betterRadio.onReceivedString(function (receivedString: string) {
            const messagePacket: MessagePacket = JSON.parse(receivedString);
            if (messagePacket.type === MessageType.BroadcastEvent && messagePacket.event === event) {
                handler(messagePacket.sender);
            }
        });
    }

    //% block="al recibir el evento $event directo de $sender"
    //% sender.shadow=device_field
    //% event.shadow=event_field
    //% group="Eventos de Difusion"
    //% draggableParameters="reporter"
    //% weight=20
    export function onReceivedEventBroadcastFromWithEvent(sender: string, event: string, handler: () => void) {
        betterRadio.onReceivedString(function (receivedString: string) {
            const messagePacket: MessagePacket = JSON.parse(receivedString);
            if (
                messagePacket.type === MessageType.BroadcastEvent &&
                messagePacket.sender === sender &&
                messagePacket.event === event
            ) {
                handler();
            }
        });
    }
}
