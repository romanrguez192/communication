//% block="Comunicacion"
//% color="#ffa500"
//% icon="\uf1eb"
namespace communication {
    radio.setGroup(1);
    radio.setTransmitSerialNumber(true);

    interface Task {
        id: number;
        callback: () => void;
        interval: number;
        lastRun: number;
        repeat: boolean;
        active: boolean;
    }

    let tasks: Task[] = [];
    let nextTaskId = 0;

    function runTasks() {
        control.inBackground(() => {
            while (true) {
                let currentTime = input.runningTime();
                for (let task of tasks) {
                    if (task.active && currentTime >= task.lastRun + task.interval) {
                        task.callback();
                        task.lastRun = currentTime;
                        if (!task.repeat) {
                            task.active = false;
                        }
                    }
                }
                tasks = tasks.filter((t) => t.active);
                basic.pause(50);
            }
        });
    }

    function addTask(callback: () => void, delay: number, repeat: boolean): number {
        let task: Task = {
            id: nextTaskId++,
            callback: callback,
            interval: delay,
            lastRun: input.runningTime(),
            repeat: repeat,
            active: true,
        };
        tasks.push(task);
        return task.id;
    }

    function clearIntervalOrTimeout(taskId: number) {
        let task = tasks.find((t) => t.id === taskId);
        if (task) {
            task.active = false;
        }
    }

    function setInterval(callback: () => void, delay = 0): number {
        return addTask(callback, delay, true);
    }

    function setTimeout(callback: () => void, delay = 0): number {
        return addTask(callback, delay, false);
    }

    function clearInterval(taskId: number): void {
        clearIntervalOrTimeout(taskId);
    }

    function clearTimeout(taskId: number): void {
        clearIntervalOrTimeout(taskId);
    }

    runTasks();

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

            messageId = (messageId + 1) % 65536;

            packets.forEach(function (packet) {
                radio.sendBuffer(packet);
                basic.pause(10);
            });
        }

        interface ReceivedPackets {
            [senderId: number]: {
                [messageId: number]: (Buffer | null)[];
            };
        }

        const receivedPackets: ReceivedPackets = {};
        const listeners: ((receivedString: string) => void)[] = [];

        function removeExpiredPackets(senderId: number, messageId: number) {
            setTimeout(function () {
                if (receivedPackets[senderId] && receivedPackets[senderId][messageId]) {
                    delete receivedPackets[senderId][messageId];
                    if (Object.keys(receivedPackets[senderId]).length === 0) {
                        delete receivedPackets[senderId];
                    }
                }
            }, 1000);
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
        Request,
        Response,
        Group,
        GroupValue,
        GroupEvent,
        Broadcast,
        BroadcastValue,
        BroadcastEvent,
    }

    export enum ConfirmationType {
        //% block="con confirmacion"
        True = 1,
        //% block="sin confirmacion"
        False = 0,
    }

    interface MessageWithConfirmation {
        confirmation: ConfirmationType;
    }

    interface BarrierDirectPacket extends MessageWithConfirmation {
        type: MessageType.BarrierDirect;
        barrierId: string;
        receiver: string;
    }

    interface BarrierGroupPacket extends MessageWithConfirmation {
        type: MessageType.BarrierGroup;
        barrierId: string;
        group: string;
    }

    interface BarrierBroadcastPacket extends MessageWithConfirmation {
        type: MessageType.BarrierBroadcast;
        barrierId: string;
    }

    interface DirectMessagePacket extends MessageWithConfirmation {
        type: MessageType.Direct;
        receiver: string;
        data: any;
    }

    interface DirectValueMessagePacket extends MessageWithConfirmation {
        type: MessageType.DirectValue;
        receiver: string;
        key: string;
        value: any;
    }

    interface DirectEventMessagePacket extends MessageWithConfirmation {
        type: MessageType.DirectEvent;
        receiver: string;
        event: string;
    }

    interface RequestMessagePacket extends MessageWithConfirmation {
        type: MessageType.Request;
        receiver: string;
        key: string;
    }

    interface ResponseMessagePacket extends MessageWithConfirmation {
        type: MessageType.Response;
        receiver: string;
        key: string;
        value: any;
    }

    interface GroupMessagePacket extends MessageWithConfirmation {
        type: MessageType.Group;
        group: string;
        data: any;
    }

    interface GroupValueMessagePacket extends MessageWithConfirmation {
        type: MessageType.GroupValue;
        group: string;
        key: string;
        value: any;
    }

    interface GroupEventMessagePacket extends MessageWithConfirmation {
        type: MessageType.GroupEvent;
        group: string;
        event: string;
    }

    interface BroadcastMessagePacket extends MessageWithConfirmation {
        type: MessageType.Broadcast;
        data: any;
    }

    interface BroadcastValueMessagePacket extends MessageWithConfirmation {
        type: MessageType.BroadcastValue;
        key: string;
        value: any;
    }

    interface BroadcastEventMessagePacket extends MessageWithConfirmation {
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
        | RequestMessagePacket
        | ResponseMessagePacket
        | GroupMessagePacket
        | GroupValueMessagePacket
        | GroupEventMessagePacket
        | BroadcastMessagePacket
        | BroadcastValueMessagePacket
        | BroadcastEventMessagePacket;

    type FullRegularMessagePacket = RegularMessagePacket & {
        id?: number;
        sender: string;
    };

    type MessagePacket = DiscoveryMessagePacket | AcknowledgementPacket | FullRegularMessagePacket;

    let myDeviceName = control.deviceName();
    const groupsJoined: string[] = [];

    interface Devices {
        [deviceId: string]: {
            lastSeen: number;
            signalStrength: number;
            additionalInfo: DeviceInfo;
        };
    }

    const activeDevices: Devices = {};

    function sendDiscoveryMessage() {
        const discoveryMessage: DiscoveryMessagePacket = {
            type: MessageType.Discovery,
            deviceId: control.deviceSerialNumber(),
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
            signalStrength: radio.receivedPacket(RadioPacketProperty.SignalStrength),
            additionalInfo,
        };
    }

    function removeInactiveDevices() {
        const currentTime = control.millis();
        const ids = Object.keys(activeDevices);
        for (const id of ids) {
            if (currentTime - activeDevices[id].lastSeen > 10000) {
                delete activeDevices[id];
            }
        }
    }

    setInterval(sendDiscoveryMessage, 5000);
    setInterval(removeInactiveDevices, 2500);

    setTimeout(sendDiscoveryMessage);

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

                const intervalId = setInterval(function () {
                    if (!acknowledgements[messageId][deviceId]) {
                        betterRadio.sendString(payload);
                    }
                }, 300);

                setTimeout(function () {
                    clearInterval(intervalId);
                    delete acknowledgements[messageId][deviceId];
                    if (Object.keys(acknowledgements[messageId]).length === 0) {
                        delete acknowledgements[messageId];
                    }
                }, 3000);
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
        fullMessagePacket.sender = myDeviceName;

        if (messagePacket.confirmation === ConfirmationType.False) {
            betterRadio.sendString(JSON.stringify(fullMessagePacket));
            return;
        }

        fullMessagePacket.id = control.micros();

        if (
            fullMessagePacket.type === MessageType.BarrierDirect ||
            fullMessagePacket.type === MessageType.Direct ||
            fullMessagePacket.type === MessageType.DirectValue ||
            fullMessagePacket.type === MessageType.DirectEvent ||
            fullMessagePacket.type === MessageType.Request ||
            fullMessagePacket.type === MessageType.Response
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

    function deleteAcknowledgedMessageById(messageId: number) {
        setTimeout(function () {
            delete acknowledgedMessages[messageId];
        }, 8000);
    }

    betterRadio.onReceivedString(function (receivedString: string) {
        const messagePacket: MessagePacket = JSON.parse(receivedString);

        if (messagePacket.type === MessageType.Discovery || messagePacket.type === MessageType.Acknowledgement) {
            return;
        }

        if ((messagePacket as any).receiver !== undefined && (messagePacket as any).receiver !== myDeviceName) {
            return;
        }

        if ((messagePacket as any).group !== undefined && groupsJoined.indexOf((messagePacket as any).group) === -1) {
            return;
        }

        if (messagePacket.confirmation === ConfirmationType.True) {
            const messageId = messagePacket.id;

            const acknowledgementPacket: AcknowledgementPacket = {
                id: messageId,
                type: MessageType.Acknowledgement,
                deviceId: control.deviceSerialNumber(),
                receiver: messagePacket.sender,
            };

            betterRadio.sendString(JSON.stringify(acknowledgementPacket));

            if (acknowledgedMessages[messageId]) {
                return;
            }

            acknowledgedMessages[messageId] = true;

            deleteAcknowledgedMessageById(messageId);
        }

        // TODO: Consider scheduling the message to be processed in the next iteration of the event loop
        for (const listener of listeners) {
            listener(messagePacket);
        }
    });

    function onMessageReceived(handler: (messagePacket: FullRegularMessagePacket) => void) {
        listeners.push(handler);
    }

    function removeMessageReceivedHandler(handler: (messagePacket: FullRegularMessagePacket) => void) {
        const index = listeners.indexOf(handler);
        if (index !== -1) {
            listeners.splice(index, 1);
        }
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
            messagePacket.type === MessageType.BarrierDirect ||
            messagePacket.type === MessageType.BarrierGroup ||
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
            confirmation: ConfirmationType.True,
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
            confirmation: ConfirmationType.True,
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
            confirmation: ConfirmationType.True,
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

    //% block="enviar mensaje $message a $receiver || $confirmation"
    //% message.shadow=text message.defl="hola"
    //% receiver.shadow=device_field receiver.defl="nombre"
    //% expandableArgumentMode="toggle"
    //% group="Mensajes Directos"
    //% weight=100
    export function sendDirectMessage(
        receiver: string,
        message: any,
        confirmation: ConfirmationType = ConfirmationType.True
    ) {
        const messagePacket: DirectMessagePacket = {
            type: MessageType.Direct,
            data: message,
            receiver,
            confirmation,
        };
        sendMessage(messagePacket);
    }

    //% block="al recibir un $mensaje directo de $emisor"
    //% group="Mensajes Directos"
    //% draggableParameters="reporter"
    //% weight=90
    export function onDirectMessageReceived(handler: (mensaje: any, emisor: string) => void) {
        onMessageReceived(function (messagePacket: FullRegularMessagePacket) {
            if (messagePacket.type === MessageType.Direct) {
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
            if (messagePacket.type === MessageType.Direct && messagePacket.sender === sender) {
                handler(messagePacket.data);
            }
        });
    }

    //% block="enviar valor $key = $value a $receiver || $confirmation"
    //% key.defl="nombre"
    //% value.shadow=math_number
    //% receiver.shadow=device_field
    //% expandableArgumentMode="toggle"
    //% group="Valores Directos"
    //% weight=100
    export function sendDirectValue(
        receiver: string,
        key: string,
        value: any,
        confirmation: ConfirmationType = ConfirmationType.True
    ) {
        const messagePacket: DirectValueMessagePacket = {
            type: MessageType.DirectValue,
            receiver,
            key,
            value,
            confirmation,
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
            if (messagePacket.type === MessageType.DirectValue && messagePacket.key === key) {
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

    //% block="enviar evento $event a $receiver || $confirmation"
    //% event.defl="evento" receiver.defl="nombre"
    //% receiver.shadow=device_field event.shadow=event_field
    //% expandableArgumentMode="toggle"
    //% group="Eventos Directos"
    //% weight=50
    export function sendDirectEvent(
        receiver: string,
        event: string,
        confirmation: ConfirmationType = ConfirmationType.True
    ) {
        const messagePacket: DirectEventMessagePacket = {
            type: MessageType.DirectEvent,
            receiver,
            event,
            confirmation,
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
            if (messagePacket.type === MessageType.DirectEvent && messagePacket.event === event) {
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
                messagePacket.sender === sender &&
                messagePacket.event === event
            ) {
                handler();
            }
        });
    }

    //% block="solicitar valor $key a $receiver"
    //% key.defl="nombre"
    //% receiver.shadow=device_field
    //% group="Solicitudes"
    //% weight=100
    export function requestValue(receiver: string, key: string): any {
        let value: any = null;

        const messagePacket: RequestMessagePacket = {
            type: MessageType.Request,
            receiver,
            key,
            confirmation: ConfirmationType.True,
        };

        sendMessage(messagePacket);

        const handler = function (messagePacket: FullRegularMessagePacket) {
            if (
                messagePacket.type === MessageType.Response &&
                messagePacket.sender === receiver &&
                messagePacket.key === key
            ) {
                value = messagePacket.value;
            }
        };

        onMessageReceived(handler);

        // TODO: Consider a timeout
        while (value === null) {
            basic.pause(100);
        }

        removeMessageReceivedHandler(handler);

        return value;
    }

    //% block="al recibir una solicitud de $key de $emisor"
    //% key.defl="nombre"
    //% group="Solicitudes"
    //% draggableParameters="reporter"
    //% weight=90
    export function onRequestReceived(key: string, handler: (emisor: string) => void) {
        onMessageReceived(function (messagePacket: FullRegularMessagePacket) {
            if (messagePacket.type === MessageType.Request && messagePacket.key === key) {
                handler(messagePacket.sender);
            }
        });
    }

    //% block="responder con valor $key = $value a $receiver"
    //% key.defl="nombre"
    //% value.shadow=math_number
    //% receiver.shadow=device_field
    //% group="Solicitudes"
    //% weight=80
    export function respondWithValue(receiver: string, key: string, value: any) {
        const messagePacket: ResponseMessagePacket = {
            type: MessageType.Response,
            receiver,
            key,
            value,
            confirmation: ConfirmationType.True,
        };

        sendMessage(messagePacket);
    }

    //% block="enviar mensaje $message al grupo $group || $confirmation"
    //% message.shadow=text message.defl="hola"
    //% group.shadow=group_field
    //% expandableArgumentMode="toggle"
    //% group="Mensajes de Grupo"
    //% weight=100
    export function sendMessageToGroup(
        group: string,
        message: any,
        confirmation: ConfirmationType = ConfirmationType.True
    ) {
        if (groupsJoined.indexOf(group) === -1) {
            return;
        }

        const messagePacket: GroupMessagePacket = {
            type: MessageType.Group,
            data: message,
            group,
            confirmation,
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
            if (messagePacket.type === MessageType.Group && messagePacket.group === group) {
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
                messagePacket.sender === sender
            ) {
                handler(messagePacket.data);
            }
        });
    }

    //% block="enviar valor $key = $value al grupo $group || $confirmation"
    //% key.defl="nombre"
    //% value.shadow=math_number
    //% group.shadow=group_field
    //% expandableArgumentMode="toggle"
    //% group="Valores de Grupo"
    //% weight=100
    export function sendValueToGroup(
        group: string,
        key: string,
        value: any,
        confirmation: ConfirmationType = ConfirmationType.True
    ) {
        if (groupsJoined.indexOf(group) === -1) {
            return;
        }

        const messagePacket: GroupValueMessagePacket = {
            type: MessageType.GroupValue,
            group,
            key,
            value,
            confirmation,
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
                messagePacket.sender === sender &&
                messagePacket.key === key
            ) {
                handler(messagePacket.value);
            }
        });
    }

    //% block="enviar evento $event al grupo $group || $confirmation"
    //% event.defl="evento"
    //% group.shadow=group_field
    //% expandableArgumentMode="toggle"
    //% group="Eventos de Grupo"
    //% weight=60
    export function sendEventToGroup(
        group: string,
        event: string,
        confirmation: ConfirmationType = ConfirmationType.True
    ) {
        if (groupsJoined.indexOf(group) === -1) {
            return;
        }

        const messagePacket: GroupEventMessagePacket = {
            type: MessageType.GroupEvent,
            group,
            event,
            confirmation,
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
                messagePacket.sender === sender &&
                messagePacket.event === event
            ) {
                handler();
            }
        });
    }

    //% block="enviar mensaje $message por difusion || $confirmation"
    //% message.shadow=text message.defl="hola"
    //% expandableArgumentMode="toggle"
    //% group="Mensajes por Difusion"
    //% weight=100
    export function broadcastMessage(message: any, confirmation: ConfirmationType = ConfirmationType.True) {
        const messagePacket: BroadcastMessagePacket = {
            type: MessageType.Broadcast,
            data: message,
            confirmation,
        };

        sendMessage(messagePacket);
    }

    //% block="al recibir un $mensaje de $emisor por difusion"
    //% group="Mensajes por Difusion"
    //% draggableParameters="reporter"
    //% weight=90
    export function onReceivedBroadcast(handler: (mensaje: any, emisor: string) => void) {
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
    export function onReceivedBroadcastFrom(sender: string, handler: (mensaje: any) => void) {
        onMessageReceived(function (messagePacket: FullRegularMessagePacket) {
            if (messagePacket.type === MessageType.Broadcast && messagePacket.sender === sender) {
                handler(messagePacket.data);
            }
        });
    }

    //% block="enviar valor $key = $value por difusion || $confirmation"
    //% key.defl="nombre"
    //% value.shadow=math_number
    //% expandableArgumentMode="toggle"
    //% group="Valores por Difusion"
    //% weight=100
    export function broadcastValue(key: string, value: any, confirmation: ConfirmationType = ConfirmationType.True) {
        const messagePacket: BroadcastValueMessagePacket = {
            type: MessageType.BroadcastValue,
            key,
            value,
            confirmation,
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

    //% block="enviar evento $event por difusion || $confirmation"
    //% event.defl="evento"
    //% expandableArgumentMode="toggle"
    //% group="Eventos por Difusion"
    //% weight=60
    export function broadcastEvent(event: string, confirmation: ConfirmationType = ConfirmationType.True) {
        const messagePacket: BroadcastEventMessagePacket = {
            type: MessageType.BroadcastEvent,
            event,
            confirmation,
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

    //% block="encontrar dispositivo mas cercano"
    //% group="Proximidad"
    //% weight=100
    export function findClosestDevice(): string {
        const devicesIds = Object.keys(activeDevices);
        let closestDevice = "";
        let closestSignalStrength = -1;

        for (const deviceId of devicesIds) {
            const signalStrength = activeDevices[deviceId].signalStrength;
            if (signalStrength > closestSignalStrength) {
                closestSignalStrength = signalStrength;
                closestDevice = activeDevices[deviceId].additionalInfo.deviceName;
            }
        }

        return closestDevice;
    }

    //% block="encontrar dispositivo mas cercano en el grupo $group"
    //% group.shadow=group_field
    //% group="Proximidad"
    //% weight=90
    export function findClosestDeviceInGroup(group: string): string {
        if (groupsJoined.indexOf(group) === -1) {
            return "";
        }

        const devicesIds = Object.keys(activeDevices);
        let closestDevice = "";
        let closestSignalStrength = -1;

        for (const deviceId of devicesIds) {
            if (activeDevices[deviceId].additionalInfo.groups.indexOf(group) !== -1) {
                const signalStrength = activeDevices[deviceId].signalStrength;
                if (signalStrength > closestSignalStrength) {
                    closestSignalStrength = signalStrength;
                    closestDevice = activeDevices[deviceId].additionalInfo.deviceName;
                }
            }
        }

        return closestDevice;
    }
}
