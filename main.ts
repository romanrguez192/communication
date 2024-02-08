//% block="Comunicacion"
//% color="#ffa500"
//% icon="\uf1eb"
namespace communication {
    radio.setGroup(1);
    radio.setTransmitSerialNumber(true);

    namespace betterRadio {
        const PACKET_SIZE = 15;
        let messageId = 0;

        export function sendString(message: string) {
            if (message.length === 0) {
                const idByte1 = messageId >> 8;
                const idByte2 = messageId & 0xff;
                const index = 0;
                const total = 1;

                const emptyMessagePacket = Buffer.fromArray([idByte1, idByte2, index, total]);

                radio.sendBuffer(emptyMessagePacket);
                messageId = (messageId + 1) % 65536;
                return;
            }

            const messageBuffer = Buffer.fromUTF8(message);

            const totalPackets = Math.ceil(messageBuffer.length / PACKET_SIZE);

            const packets: Buffer[] = [];

            for (let i = 0; i < messageBuffer.length; i += PACKET_SIZE) {
                const idByte1 = messageId >> 8;
                const idByte2 = messageId & 0xff;
                const index = i / PACKET_SIZE;
                const total = totalPackets;
                const segment = messageBuffer.slice(i, i + PACKET_SIZE);

                const packet = Buffer.fromArray([idByte1, idByte2, index, total]).concat(segment);
                packets.push(packet);
            }

            packets.forEach(function (packet) {
                radio.sendBuffer(packet);
            });

            messageId = (messageId + 1) % 65536;
        }

        interface ReceivedPackets {
            [senderId: number]: {
                [messageId: number]: (Buffer | null)[];
            };
        }

        const receivedPackets: ReceivedPackets = {};
        const listeners: ((receivedString: string) => void)[] = [];

        function removeExpiredPackets(senderId: number, messageId: number) {
            control.setInterval(
                function () {
                    if (receivedPackets[senderId] && receivedPackets[senderId][messageId]) {
                        delete receivedPackets[senderId][messageId];
                        if (Object.keys(receivedPackets[senderId]).length === 0) {
                            delete receivedPackets[senderId];
                        }
                    }
                },
                8000,
                control.IntervalMode.Timeout
            );
        }

        radio.onReceivedBuffer(function (receivedBuffer) {
            const senderId = radio.receivedSerial();
            const messageId = (receivedBuffer[0] << 8) | receivedBuffer[1];
            const index = receivedBuffer[2];
            const total = receivedBuffer[3];
            const content = receivedBuffer.slice(4);

            if (!receivedPackets[senderId]) {
                receivedPackets[senderId] = {};
            }

            if (!receivedPackets[senderId][messageId]) {
                const packets: (Buffer | null)[] = [];
                for (let i = 0; i < total; i++) {
                    packets.push(null);
                }
                receivedPackets[senderId][messageId] = packets;

                removeExpiredPackets(senderId, messageId);
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
                const messageBuffer = Buffer.concat(receivedPackets[senderId][messageId]);
                const message = messageBuffer.toString();

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
        Discovery,
        Acknowledgement,
        BarrierDirect,
        BarrierGroup,
        BarrierBroadcast,
        Direct,
        DirectValue,
        DirectEvent,
        Group,
        GroupValue,
        GroupEvent,
        Broadcast,
        BroadcastValue,
        BroadcastEvent,
    }

    interface BarrierDirectPacket {
        type: MessageType.BarrierDirect;
        barrierId: string;
        receiver: string;
    }

    interface BarrierGroupPacket {
        type: MessageType.BarrierGroup;
        barrierId: string;
        group: string;
    }

    interface BarrierBroadcastPacket {
        type: MessageType.BarrierBroadcast;
        barrierId: string;
    }

    interface DirectMessagePacket {
        type: MessageType.Direct;
        receiver: string;
        data: any;
    }

    interface DirectValueMessagePacket {
        type: MessageType.DirectValue;
        receiver: string;
        key: string;
        value: any;
    }

    interface DirectEventMessagePacket {
        type: MessageType.DirectEvent;
        receiver: string;
        event: string;
    }

    interface GroupMessagePacket {
        type: MessageType.Group;
        group: string;
        data: any;
    }

    interface GroupValueMessagePacket {
        type: MessageType.GroupValue;
        group: string;
        key: string;
        value: any;
    }

    interface GroupEventMessagePacket {
        type: MessageType.GroupEvent;
        group: string;
        event: string;
    }

    interface BroadcastMessagePacket {
        type: MessageType.Broadcast;
        data: any;
    }

    interface BroadcastValueMessagePacket {
        type: MessageType.BroadcastValue;
        key: string;
        value: any;
    }

    interface BroadcastEventMessagePacket {
        type: MessageType.BroadcastEvent;
        event: string;
    }

    interface DeviceInfo {
        deviceName: string;
        groups: string[];
    }

    interface DiscoveryMessagePacket {
        type: MessageType.Discovery;
        deviceId: number;
        additionalInfo: DeviceInfo;
    }

    interface AcknowledgementPacket {
        type: MessageType.Acknowledgement;
        deviceId: number;
        receiver: string;
        id: number;
    }

    type RegularMessagePacket =
        | BarrierDirectPacket
        | BarrierGroupPacket
        | BarrierBroadcastPacket
        | DirectMessagePacket
        | DirectValueMessagePacket
        | DirectEventMessagePacket
        | GroupMessagePacket
        | GroupValueMessagePacket
        | GroupEventMessagePacket
        | BroadcastMessagePacket
        | BroadcastValueMessagePacket
        | BroadcastEventMessagePacket;

    type FullRegularMessagePacket = RegularMessagePacket & {
        id: number;
        sender: string;
    };

    type MessagePacket = DiscoveryMessagePacket | AcknowledgementPacket | FullRegularMessagePacket;

    let myDeviceName = control.deviceName();
    const groupsJoined: string[] = [];

    const DISCOVERY_INTERVAL = 5000;
    const TIMEOUT_INTERVAL = 10000;
    const CHECK_INTERVAL = 2500;
    const DEVICE_ID = control.deviceSerialNumber();

    interface Devices {
        [deviceId: string]: {
            lastSeen: number;
            additionalInfo: DeviceInfo;
        };
    }

    const activeDevices: Devices = {};

    function sendDiscoveryMessage() {
        const discoveryMessage: DiscoveryMessagePacket = {
            type: MessageType.Discovery,
            deviceId: DEVICE_ID,
            additionalInfo: {
                deviceName: myDeviceName,
                groups: groupsJoined,
            },
        };

        betterRadio.sendString(JSON.stringify(discoveryMessage));
    }

    betterRadio.onReceivedString(function (receivedString: string) {
        const message: MessagePacket = JSON.parse(receivedString);
        if (message.type === MessageType.Discovery) {
            handleDiscoveryMessage(message);
        }
    });

    function handleDiscoveryMessage(message: DiscoveryMessagePacket) {
        const { deviceId, additionalInfo } = message;
        activeDevices[deviceId] = {
            lastSeen: control.millis(),
            additionalInfo,
        };
    }

    function removeInactiveDevices() {
        const currentTime = control.millis();
        const ids = Object.keys(activeDevices);
        for (const id of ids) {
            if (currentTime - activeDevices[id].lastSeen > TIMEOUT_INTERVAL) {
                delete activeDevices[id];
            }
        }
    }

    control.setInterval(sendDiscoveryMessage, DISCOVERY_INTERVAL, control.IntervalMode.Interval);
    control.setInterval(removeInactiveDevices, CHECK_INTERVAL, control.IntervalMode.Interval);

    sendDiscoveryMessage();

    const acknowledgements: { [messageId: number]: { [deviceId: string]: boolean } } = {};

    function sendMessageWithAck(
        messagePacket: FullRegularMessagePacket,
        predicate: (additionalInfo: DeviceInfo) => boolean
    ) {
        const messageId = messagePacket.id;
        const payload = JSON.stringify(messagePacket);
        betterRadio.sendString(payload);

        const devicesIds = Object.keys(activeDevices);

        for (const deviceId of devicesIds) {
            if (predicate(activeDevices[deviceId].additionalInfo)) {
                if (!acknowledgements[messageId]) {
                    acknowledgements[messageId] = {};
                }

                acknowledgements[messageId][deviceId] = false;

                const intervalId = control.setInterval(
                    function () {
                        if (!acknowledgements[messageId][deviceId]) {
                            betterRadio.sendString(payload);
                        }
                    },
                    300,
                    control.IntervalMode.Interval
                );

                control.setInterval(
                    function () {
                        control.clearInterval(intervalId, control.IntervalMode.Interval);
                        delete acknowledgements[messageId][deviceId];
                        if (Object.keys(acknowledgements[messageId]).length === 0) {
                            delete acknowledgements[messageId];
                        }
                    },
                    3000,
                    control.IntervalMode.Timeout
                );
            }
        }
    }

    betterRadio.onReceivedString(function (receivedString: string) {
        const messagePacket: MessagePacket = JSON.parse(receivedString);
        if (messagePacket.type === MessageType.Acknowledgement && messagePacket.receiver === myDeviceName) {
            const messageId = messagePacket.id;
            const deviceId = messagePacket.deviceId;

            if (acknowledgements[messageId] && acknowledgements[messageId][deviceId] === false) {
                acknowledgements[messageId][deviceId] = true;
            }
        }
    });

    const acknowledgedMessages: { [messageId: number]: boolean } = {};

    function sendMessage(messagePacket: RegularMessagePacket) {
        const fullMessagePacket = messagePacket as FullRegularMessagePacket;
        fullMessagePacket.id = control.micros();
        fullMessagePacket.sender = myDeviceName;

        if (
            fullMessagePacket.type === MessageType.BarrierDirect ||
            fullMessagePacket.type === MessageType.Direct ||
            fullMessagePacket.type === MessageType.DirectValue ||
            fullMessagePacket.type === MessageType.DirectEvent
        ) {
            const { receiver } = fullMessagePacket;
            sendMessageWithAck(fullMessagePacket, (additionalInfo) => additionalInfo.deviceName === receiver);
        }

        if (
            fullMessagePacket.type === MessageType.BarrierGroup ||
            fullMessagePacket.type === MessageType.Group ||
            fullMessagePacket.type === MessageType.GroupValue ||
            fullMessagePacket.type === MessageType.GroupEvent
        ) {
            const { group } = fullMessagePacket;
            sendMessageWithAck(fullMessagePacket, (additionalInfo) => additionalInfo.groups.indexOf(group) !== -1);
        }

        if (
            fullMessagePacket.type === MessageType.BarrierBroadcast ||
            fullMessagePacket.type === MessageType.Broadcast ||
            fullMessagePacket.type === MessageType.BroadcastValue ||
            fullMessagePacket.type === MessageType.BroadcastEvent
        ) {
            sendMessageWithAck(fullMessagePacket, () => true);
        }
    }

    const listeners: ((messagePacket: FullRegularMessagePacket) => void)[] = [];

    betterRadio.onReceivedString(function (receivedString: string) {
        const messagePacket: MessagePacket = JSON.parse(receivedString);

        if (messagePacket.type === MessageType.Discovery || messagePacket.type === MessageType.Acknowledgement) {
            return;
        }

        const messageId = messagePacket.id;

        const acknowledgementPacket: AcknowledgementPacket = {
            id: messageId,
            type: MessageType.Acknowledgement,
            deviceId: DEVICE_ID,
            receiver: messagePacket.sender,
        };

        betterRadio.sendString(JSON.stringify(acknowledgementPacket));

        if (acknowledgedMessages[messageId]) {
            return;
        }

        acknowledgedMessages[messageId] = true;

        control.setInterval(
            function () {
                delete acknowledgedMessages[messageId];
            },
            8000,
            control.IntervalMode.Timeout
        );

        for (const listener of listeners) {
            listener(messagePacket);
        }
    });

    function onMessageReceived(handler: (messagePacket: FullRegularMessagePacket) => void) {
        listeners.push(handler);
    }

    // TODO: Consider removing this block and channels in general

    //% block="establecer canal de comunicacion a $canal"
    //% change.defl=1
    //% canal.min=0 canal.max=255
    //% group="Configuracion"
    //% weight=110
    export function setChannel(canal: number) {
        radio.setGroup(canal);
    }

    // TODO: Consider multiple devices with the same name

    //% block="registrar dispositivo con nombre $name"
    //% group="Configuracion"
    //% weight=100
    export function registerDevice(name: string) {
        myDeviceName = name;
        sendDiscoveryMessage();
    }

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
    //% group="Configuracion"
    //% weight=90
    export function joinGroup(group: string) {
        if (groupsJoined.indexOf(group) === -1) {
            groupsJoined.push(group);
            sendDiscoveryMessage();
        }
    }

    //% block="salir del grupo $group"
    //% group.shadow=group_field
    //% group="Configuracion"
    //% weight=80
    export function leaveGroup(group: string) {
        const index = groupsJoined.indexOf(group);
        if (index !== -1) {
            groupsJoined.splice(index, 1);
            sendDiscoveryMessage();
        }
    }

    //% block="$device"
    //% blockId=device_field
    //% blockHidden=true shim=TD_ID
    //% device.fieldEditor="autocomplete" device.fieldOptions.decompileLiterals=true
    //% device.fieldOptions.key="devices"
    export function _deviceField(device: string) {
        return device;
    }

    //% block="esperar por $numberOfDevices dispositivos conectados"
    //% numberOfDevices.defl=2
    //% group="Sincronizacion"
    //% weight=100
    export function waitForDevices(numberOfDevices: number) {
        while (true) {
            if (Object.keys(activeDevices).length + 1 >= numberOfDevices) {
                return;
            }
            basic.pause(100);
        }
    }

    //% block="esperar por $deviceName conectado"
    //% deviceName.shadow=device_field deviceName.defl="nombre"
    //% group="Sincronizacion"
    //% weight=90
    export function waitForDevice(deviceName: string) {
        const devicesIds = Object.keys(activeDevices);
        while (true) {
            for (const deviceId of devicesIds) {
                if (activeDevices[deviceId].additionalInfo.deviceName === deviceName) {
                    return;
                }
            }
            basic.pause(100);
        }
    }

    //% block="esperar por $numberOfDevices dispositivos conectados en el grupo $group"
    //% numberOfDevices.defl=2
    //% group.shadow=group_field group.defl="grupo"
    //% group="Sincronizacion"
    //% weight=80
    export function waitForDevicesInGroup(numberOfDevices: number, group: string) {
        if (groupsJoined.indexOf(group) === -1) {
            return;
        }

        while (true) {
            let count = 1;
            const devicesIds = Object.keys(activeDevices);
            for (const deviceId of devicesIds) {
                if (activeDevices[deviceId].additionalInfo.groups.indexOf(group) !== -1) {
                    count++;
                }
            }
            if (count >= numberOfDevices) {
                return;
            }
            basic.pause(100);
        }
    }

    const barrierReached: { [barrierId: string]: string[] } = {};

    onMessageReceived(function (messagePacket: FullRegularMessagePacket) {
        if (
            (messagePacket.type === MessageType.BarrierDirect && messagePacket.receiver === myDeviceName) ||
            (messagePacket.type === MessageType.BarrierGroup && groupsJoined.indexOf(messagePacket.group) !== -1) ||
            messagePacket.type === MessageType.BarrierBroadcast
        ) {
            const { barrierId, sender } = messagePacket;
            if (!barrierReached[barrierId]) {
                barrierReached[barrierId] = [sender];
            } else if (barrierReached[barrierId].indexOf(sender) === -1) {
                barrierReached[barrierId].push(sender);
            }
        }
    });

    //% block="esperar por $deviceName en el punto de encuentro $barrierId"
    //% deviceName.shadow=device_field deviceName.defl="nombre"
    //% barrierId.defl="reunion1"
    //% group="Sincronizacion"
    //% weight=70
    export function synchronizationBarrierDirect(deviceName: string, barrierId: string) {
        if (!barrierReached[barrierId]) {
            barrierReached[barrierId] = [myDeviceName];
        } else if (barrierReached[barrierId].indexOf(myDeviceName) === -1) {
            barrierReached[barrierId].push(myDeviceName);
        }

        const messagePacket: BarrierDirectPacket = {
            type: MessageType.BarrierDirect,
            receiver: deviceName,
            barrierId,
        };

        sendMessage(messagePacket);

        const isLastDevice = barrierReached[barrierId].indexOf(deviceName) !== -1;

        while (barrierReached[barrierId].indexOf(deviceName) === -1) {
            basic.pause(100);
        }

        if (isLastDevice) {
            basic.pause(100);
        }

        delete barrierReached[barrierId];
    }

    //% block="esperar por el grupo $group en el punto de encuentro $barrierId"
    //% group.shadow=group_field group.defl="grupo"
    //% barrierId.defl="reunion2"
    //% group="Sincronizacion"
    //% weight=60
    export function synchronizationBarrierGroup(group: string, barrierId: string) {
        if (groupsJoined.indexOf(group) === -1) {
            return;
        }

        if (!barrierReached[barrierId]) {
            barrierReached[barrierId] = [myDeviceName];
        } else if (barrierReached[barrierId].indexOf(myDeviceName) === -1) {
            barrierReached[barrierId].push(myDeviceName);
        }

        const messagePacket: BarrierGroupPacket = {
            type: MessageType.BarrierGroup,
            group,
            barrierId,
        };

        sendMessage(messagePacket);

        const groupCount = Object.keys(activeDevices).filter(
            (deviceId) => activeDevices[deviceId].additionalInfo.groups.indexOf(group) !== -1
        ).length;

        const isLastDevice = barrierReached[barrierId].length === groupCount;

        while (true) {
            const groupCount =
                Object.keys(activeDevices).filter(
                    (deviceId) => activeDevices[deviceId].additionalInfo.groups.indexOf(group) !== -1
                ).length + 1;

            if (barrierReached[barrierId].length === groupCount) {
                break;
            }

            basic.pause(100);
        }

        if (isLastDevice) {
            basic.pause(100);
        }

        delete barrierReached[barrierId];
    }

    //% block="esperar por todos en el punto de encuentro $barrierId"
    //% barrierId.defl="reunion3"
    //% group="Sincronizacion"
    //% weight=50
    export function synchronizationBarrierBroadcast(barrierId: string) {
        if (!barrierReached[barrierId]) {
            barrierReached[barrierId] = [myDeviceName];
        } else if (barrierReached[barrierId].indexOf(myDeviceName) === -1) {
            barrierReached[barrierId].push(myDeviceName);
        }

        const messagePacket: BarrierBroadcastPacket = {
            type: MessageType.BarrierBroadcast,
            barrierId,
        };

        sendMessage(messagePacket);

        const devicesCount = Object.keys(activeDevices).length + 1;

        const isLastDevice = barrierReached[barrierId].length === devicesCount;

        while (barrierReached[barrierId].length < devicesCount) {
            basic.pause(100);
        }

        if (isLastDevice) {
            basic.pause(100);
        }

        delete barrierReached[barrierId];
    }

    //% block="enviar mensaje $message a $receiver"
    //% message.shadow=text message.defl="hola"
    //% receiver.shadow=device_field receiver.defl="nombre"
    //% group="Mensajes Directos"
    //% weight=100
    export function sendDirectMessage(receiver: string, message: any) {
        const messagePacket: DirectMessagePacket = {
            type: MessageType.Direct,
            data: message,
            receiver,
        };
        sendMessage(messagePacket);
    }

    //% block="al recibir un $mensaje directo de $emisor"
    //% group="Mensajes Directos"
    //% draggableParameters="reporter"
    //% weight=90
    export function onDirectMessageReceived(handler: (mensaje: any, emisor: string) => void) {
        onMessageReceived(function (messagePacket: FullRegularMessagePacket) {
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
        onMessageReceived(function (messagePacket: FullRegularMessagePacket) {
            if (
                messagePacket.type === MessageType.Direct &&
                messagePacket.receiver === myDeviceName &&
                messagePacket.sender === sender
            ) {
                handler(messagePacket.data);
            }
        });
    }

    //% block="enviar valor $key = $value a $receiver"
    //% key.defl="nombre"
    //% value.shadow=math_number
    //% receiver.shadow=device_field
    //% group="Valores Directos"
    //% weight=100
    export function sendDirectValue(receiver: string, key: string, value: any) {
        const messagePacket: DirectValueMessagePacket = {
            type: MessageType.DirectValue,
            receiver,
            key,
            value,
        };
        sendMessage(messagePacket);
    }

    //% block="al recibir $key de $emisor con $valor"
    //% key.defl="nombre"
    //% group="Valores Directos"
    //% draggableParameters="reporter"
    //% weight=90
    export function onDirectValueReceived(key: string, handler: (valor: any, emisor: string) => void) {
        onMessageReceived(function (messagePacket: FullRegularMessagePacket) {
            if (
                messagePacket.type === MessageType.DirectValue &&
                messagePacket.receiver === myDeviceName &&
                messagePacket.key === key
            ) {
                handler(messagePacket.value, messagePacket.sender);
            }
        });
    }

    //% block="al recibir $key de $sender con $valor"
    //% key.defl="nombre"
    //% sender.shadow=device_field
    //% group="Valores Directos"
    //% draggableParameters="reporter"
    //% weight=80
    export function onDirectValueReceivedFrom(sender: string, key: string, handler: (valor: any) => void) {
        onMessageReceived(function (messagePacket: FullRegularMessagePacket) {
            if (
                messagePacket.type === MessageType.DirectValue &&
                messagePacket.receiver === myDeviceName &&
                messagePacket.sender === sender &&
                messagePacket.key === key
            ) {
                handler(messagePacket.value);
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
            receiver,
            event,
        };
        sendMessage(messagePacket);
    }

    //% block="al recibir el evento $event directo de $emisor"
    //% event.shadow=event_field
    //% group="Eventos Directos"
    //% draggableParameters="reporter"
    //% weight=20
    export function onDirectEventReceivedWithEvent(event: string, handler: (emisor: string) => void) {
        onMessageReceived(function (messagePacket: FullRegularMessagePacket) {
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
        onMessageReceived(function (messagePacket: FullRegularMessagePacket) {
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
            data: message,
            group,
        };

        sendMessage(messagePacket);
    }

    //% block="al recibir un $mensaje de $emisor en el grupo $group"
    //% group.shadow=group_field
    //% group="Mensajes de Grupo"
    //% draggableParameters="reporter"
    //% weight=90
    export function onReceivedMessageFromGroup(group: string, handler: (mensaje: any, emisor: string) => void) {
        onMessageReceived(function (messagePacket: FullRegularMessagePacket) {
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
        onMessageReceived(function (messagePacket: FullRegularMessagePacket) {
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

    //% block="enviar valor $key = $value al grupo $group"
    //% key.defl="nombre"
    //% value.shadow=math_number
    //% group.shadow=group_field
    //% group="Valores de Grupo"
    //% weight=100
    export function sendValueToGroup(group: string, key: string, value: any) {
        if (groupsJoined.indexOf(group) === -1) {
            return;
        }

        const messagePacket: GroupValueMessagePacket = {
            type: MessageType.GroupValue,
            group,
            key,
            value,
        };

        sendMessage(messagePacket);
    }

    //% block="al recibir $key de $emisor en el grupo $group con $valor"
    //% key.defl="nombre"
    //% group.shadow=group_field
    //% group="Valores de Grupo"
    //% draggableParameters="reporter"
    //% weight=90
    export function onReceivedValueFromGroup(
        group: string,
        key: string,
        handler: (valor: any, emisor: string) => void
    ) {
        onMessageReceived(function (messagePacket: FullRegularMessagePacket) {
            if (
                messagePacket.type === MessageType.GroupValue &&
                messagePacket.group === group &&
                groupsJoined.indexOf(group) !== -1 &&
                messagePacket.key === key
            ) {
                handler(messagePacket.value, messagePacket.sender);
            }
        });
    }

    //% block="al recibir $key de $sender en el grupo $group con $valor"
    //% key.defl="nombre"
    //% sender.shadow=device_field
    //% group.shadow=group_field
    //% group="Valores de Grupo"
    //% draggableParameters="reporter"
    //% weight=80
    export function onReceivedValueFromGroupFrom(
        group: string,
        sender: string,
        key: string,
        handler: (valor: any) => void
    ) {
        onMessageReceived(function (messagePacket: FullRegularMessagePacket) {
            if (
                messagePacket.type === MessageType.GroupValue &&
                messagePacket.group === group &&
                groupsJoined.indexOf(group) !== -1 &&
                messagePacket.sender === sender &&
                messagePacket.key === key
            ) {
                handler(messagePacket.value);
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
            group,
            event,
        };

        sendMessage(messagePacket);
    }

    //% block="al recibir el evento $event de $emisor en el grupo $group"
    //% event.shadow=event_field
    //% group.shadow=group_field
    //% group="Eventos de Grupo"
    //% draggableParameters="reporter"
    //% weight=30
    export function onReceivedEventFromGroupWithEvent(group: string, event: string, handler: (emisor: string) => void) {
        onMessageReceived(function (messagePacket: FullRegularMessagePacket) {
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
        onMessageReceived(function (messagePacket: FullRegularMessagePacket) {
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
    //% group="Mensajes por Difusion"
    //% weight=100
    export function broadcastMessage(message: any) {
        const messagePacket: BroadcastMessagePacket = {
            type: MessageType.Broadcast,
            data: message,
        };

        sendMessage(messagePacket);
    }

    //% block="al recibir un $mensaje de $emisor por difusion"
    //% group="Mensajes por Difusion"
    //% draggableParameters="reporter"
    //% weight=90
    export function onReceivedBroadcast(handler: (mensaje: string, emisor: string) => void) {
        onMessageReceived(function (messagePacket: FullRegularMessagePacket) {
            if (messagePacket.type === MessageType.Broadcast) {
                handler(messagePacket.data, messagePacket.sender);
            }
        });
    }

    //% block="al recibir un $mensaje de $sender por difusion"
    //% sender.shadow=device_field
    //% group="Mensajes por Difusion"
    //% draggableParameters="reporter"
    //% weight=85
    export function onReceivedBroadcastFrom(sender: string, handler: (mensaje: string) => void) {
        onMessageReceived(function (messagePacket: FullRegularMessagePacket) {
            if (
                messagePacket.type === MessageType.Broadcast &&
                messagePacket.sender === sender &&
                typeof messagePacket.data === "string"
            ) {
                handler(messagePacket.data);
            }
        });
    }

    //% block="enviar valor $key = $value por difusion"
    //% key.defl="nombre"
    //% value.shadow=math_number
    //% group="Valores por Difusion"
    //% weight=100
    export function broadcastValue(key: string, value: any) {
        const messagePacket: BroadcastValueMessagePacket = {
            type: MessageType.BroadcastValue,
            key,
            value,
        };

        sendMessage(messagePacket);
    }

    //% block="al recibir $key de $emisor por difusion con $valor"
    //% key.defl="nombre"
    //% group="Valores por Difusion"
    //% draggableParameters="reporter"
    //% weight=90
    export function onReceivedValueBroadcast(key: string, handler: (valor: any, emisor: string) => void) {
        onMessageReceived(function (messagePacket: FullRegularMessagePacket) {
            if (messagePacket.type === MessageType.BroadcastValue && messagePacket.key === key) {
                handler(messagePacket.value, messagePacket.sender);
            }
        });
    }

    //% block="al recibir $key de $sender por difusion con $valor"
    //% key.defl="nombre"
    //% sender.shadow=device_field
    //% group="Valores por Difusion"
    //% draggableParameters="reporter"
    //% weight=80
    export function onReceivedValueBroadcastFrom(sender: string, key: string, handler: (valor: any) => void) {
        onMessageReceived(function (messagePacket: FullRegularMessagePacket) {
            if (
                messagePacket.type === MessageType.BroadcastValue &&
                messagePacket.sender === sender &&
                messagePacket.key === key
            ) {
                handler(messagePacket.value);
            }
        });
    }

    //% block="enviar evento $event por difusion"
    //% event.defl="evento"
    //% group="Eventos por Difusion"
    //% weight=60
    export function broadcastEvent(event: string) {
        const messagePacket: BroadcastEventMessagePacket = {
            type: MessageType.BroadcastEvent,
            event,
        };

        sendMessage(messagePacket);
    }

    //% block="al recibir el evento $event de difusion de $emisor"
    //% event.shadow=event_field
    //% group="Eventos por Difusion"
    //% draggableParameters="reporter"
    //% weight=30
    export function onReceivedEventBroadcastWithEvent(event: string, handler: (emisor: string) => void) {
        onMessageReceived(function (messagePacket: FullRegularMessagePacket) {
            if (messagePacket.type === MessageType.BroadcastEvent && messagePacket.event === event) {
                handler(messagePacket.sender);
            }
        });
    }

    //% block="al recibir el evento $event difusion de $sender"
    //% sender.shadow=device_field
    //% event.shadow=event_field
    //% group="Eventos por Difusion"
    //% draggableParameters="reporter"
    //% weight=20
    export function onReceivedEventBroadcastFromWithEvent(sender: string, event: string, handler: () => void) {
        onMessageReceived(function (messagePacket: FullRegularMessagePacket) {
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
