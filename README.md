# Extension de Comunicacion para MakeCode y Micro:bit

La extension "Comunicacion" mejora las capacidades de comunicacion entre dispositivos Microbit, permitiendo una interaccion mas avanzada y personalizada en proyectos educativos y de entretenimiento.

## Uso como Extension

Este repositorio puede ser agregado como una **extension** en MakeCode.

-   Abre [https://makecode.microbit.org/](https://makecode.microbit.org/)
-   Haz clic en **Nuevo Proyecto**
-   Haz clic en **Extensiones** dentro del menu de la rueda dentada
-   Busca por **https://github.com/romanrguez192/communication** e importa

## Editar este Proyecto

Para editar este repositorio en MakeCode:

-   Abre [https://makecode.microbit.org/](https://makecode.microbit.org/)
-   Haz clic en **Importar**, luego en **Importar URL**
-   Pega **https://github.com/romanrguez192/communication** y haz clic en importar

## Bloques Disponibles

La extension "Comunicacion" proporciona una variedad de bloques para la comunicacion entre dispositivos Micro:bit, permitiendo configuraciones personalizadas, sincronizacion y la transmision de diferentes tipos de datos. A continuacion, se detallan los bloques disponibles y ejemplos de su uso.

### Configuracion

#### Establecer Canal de Comunicacion

```blocks
communication.setChannel(1)
```

Configura el canal de comunicacion (0-255) para limitar la interferencia con otros dispositivos.

#### Registrar Dispositivo con Nombre

```blocks
communication.registerDevice("Alice")
```

Asigna un nombre identificativo a tu dispositivo Micro:bit, facilitando su identificacion en la red.

### Grupos

#### Unirse al Grupo

```blocks
communication.joinGroup("Exploradores")
```

Permite que el dispositivo se una a un grupo especifico para comunicarse unicamente con los miembros de ese grupo.

#### Salir del Grupo

```blocks
communication.leaveGroup("Exploradores")
```

Retira el dispositivo del grupo especificado, deteniendo la recepcion de mensajes de ese grupo.

### Sincronizacion

#### Esperar por Dispositivos Conectados

```blocks
communication.waitForDevices(2)
```

Bloquea la ejecucion del programa hasta que el numero especificado de dispositivos se haya conectado.

#### Esperar por Dispositivo Especifico

```blocks
communication.waitForDevice("Bob")
```

Detiene la ejecucion del programa hasta que el dispositivo con el nombre especificado se conecte.

#### Esperar por Dispositivos Conectados en Grupo

```blocks
communication.waitForDevicesInGroup(2, "Exploradores")
```

Bloquea la ejecucion del programa hasta que el numero especificado de dispositivos del grupo especificado se haya conectado.

#### Puntos de Encuentro de Sincronizacion Directa

```blocks
communication.synchronizationBarrierDirect("Alice", "inicioJuego")
```

Sincroniza acciones entre dispositivos en puntos especificos del programa, esperando a que un dispositivo especifico alcance el punto de encuentro antes de continuar.

#### Puntos de Encuentro de Sincronizacion de Grupo

```blocks
communication.synchronizationBarrierGroup("Exploradores", "puntoReunion")
```

Sincroniza acciones entre dispositivos de un grupo en puntos especificos del programa, esperando a que todos los dispositivos del grupo alcancen el punto de encuentro antes de continuar.

#### Puntos de Encuentro de Sincronizacion por Difusion

```blocks
communication.synchronizationBarrierBroadcast("finJuego")
```

Sincroniza acciones entre todos los dispositivos en el canal de comunicacion en puntos especificos del programa, esperando a que todos los dispositivos alcancen el punto de encuentro antes de continuar.

### Mensajes Directos

#### Enviar Mensaje Directo

```blocks
communication.sendDirectMessage("Bob", "Hola")
```

Envia un mensaje directamente a un dispositivo especifico identificado por su nombre.

#### Recibir Mensaje Directo

```blocks
communication.onDirectMessageReceived(function(mensaje, emisor) {
    basic.showString(mensaje)
})
```

Define una accion a realizar cuando se recibe un mensaje directo de cualquier dispositivo.

#### Recibir Mensaje Directo de Emisor Especifico

```blocks
communication.onDirectMessageReceivedFrom("Bob", function(mensaje) {
    basic.showString(mensaje)
})
```

Define una accion a realizar cuando se recibe un mensaje directo de un emisor especifico.

### Valores Directos

#### Enviar Valor Directo

```blocks
communication.sendDirectValue("Bob", "temperatura", 25)
```

Envia un valor con nombre a un dispositivo especifico identificado por su nombre.

#### Recibir Valor Directo

```blocks
communication.onDirectValueReceived("temperatura", function(valor, emisor) {
    basic.showNumber(valor)
})
```

Define una accion a realizar cuando se recibe un valor con nombre de cualquier dispositivo.

#### Recibir Valor Directo de Emisor Especifico

```blocks
communication.onDirectValueReceivedFrom("Bob", "temperatura", function(valor) {
    basic.showNumber(valor)
})
```

Define una accion a realizar cuando se recibe un valor con nombre de un emisor especifico.

### Eventos Directos

#### Enviar Evento Directo

```blocks
communication.sendDirectEvent("Bob", "inicio")
```

Envia un evento directamente a un dispositivo especifico, lo que puede desencadenar acciones especificas en el receptor.

#### Escuchar por Evento Especifico

```blocks
communication.onDirectEventReceivedWithEvent("inicio", function(emisor) {
    basic.showString("Inicio desde " + emisor)
})
```

Ejecuta acciones en respuesta a la recepcion de un evento especifico enviado por cualquier dispositivo.

#### Escuchar por Evento Especifico de Emisor Especifico

```blocks
communication.onDirectEventReceivedFromWithEvent("Alice", "inicio", function() {
    basic.showString("Inicio desde Alice")
})
```

Ejecuta acciones en respuesta a la recepcion de un evento especifico enviado por un emisor especifico.

### Solicitudes

#### Enviar Solicitud

```blocks
let value = communication.requestValue("Bob", "temperatura")
basic.showNumber(value)
```

Envia una solicitud a un dispositivo especifico identificado por su nombre, esperando una respuesta.

#### Recibir Solicitud

```blocks
communication.onRequestReceived("temperatura", function(emisor) {

})
```

Define una accion a realizar cuando se recibe una solicitud de cualquier dispositivo.

#### Responder a Solicitud

```blocks
communication.respondWithValue("Alice", "temperatura", 25)
```

Envia una respuesta a una solicitud recibida, con un valor con nombre especifico.

### Mensajes de Grupo

#### Enviar Mensaje al Grupo

```blocks
communication.sendMessageToGroup("Exploradores", "¡Reunion!")
```

Envia un mensaje a todos los miembros de un grupo especifico.

#### Recibir Mensaje de Grupo

```blocks
communication.onReceivedMessageFromGroup("Exploradores", function(mensaje, emisor) {
    basic.showString(mensaje)
})
```

Define una accion a realizar cuando se recibe un mensaje de cualquier miembro del grupo especificado.

#### Recibir Mensaje de Grupo con Emisor Especifico

```blocks
communication.onReceivedMessageFromGroupFrom("Exploradores", "Bob", function(mensaje) {
    basic.showString(mensaje)
})
```

Define una accion a realizar cuando se recibe un mensaje de un emisor especifico en el grupo especificado.

### Valores de Grupo

#### Enviar Valor al Grupo

```blocks
communication.sendValueToGroup("Exploradores", "temperatura", 25)
```

Envia un valor con nombre a todos los miembros de un grupo especifico.

#### Recibir Valor de Grupo

```blocks
communication.onReceivedValueFromGroup("Exploradores", "temperatura", function(valor, emisor) {
    basic.showNumber(valor)
})
```

Ejecuta acciones en respuesta a la recepcion de un valor con nombre enviado por cualquier miembro del grupo.

#### Recibir Valor de Grupo con Emisor Especifico

```blocks
communication.onReceivedValueFromGroupFrom("Exploradores", "Bob", "temperatura", function(valor) {
    basic.showNumber(valor)
})
```

Ejecuta acciones en respuesta a la recepcion de un valor con nombre enviado por un emisor especifico en el grupo especificado.

### Eventos de Grupo

#### Enviar Evento al Grupo

```blocks
communication.sendEventToGroup("Exploradores", "inicioActividad")
```

Envia un evento a todos los miembros de un grupo especifico, lo que puede desencadenar acciones especificas en los receptores.

#### Recibir Evento de Grupo

```blocks
communication.onReceivedEventFromGroupWithEvent("Exploradores", "inicioActividad", function(emisor) {
    basic.showString("Actividad iniciada por " + emisor)
})
```

Ejecuta acciones en respuesta a la recepcion de un evento especifico enviado por cualquier miembro del grupo.

#### Recibir Evento de Grupo con Emisor Especifico

```blocks
communication.onReceivedEventFromGroupFromWithEvent("Exploradores", "Bob", "inicioActividad", function() {
    basic.showString("Actividad iniciada por Bob")
})
```

Ejecuta acciones en respuesta a la recepcion de un evento especifico enviado por un emisor especifico en el grupo especificado.

### Mensajes por Difusion

#### Enviar Mensaje por Difusion

```blocks
communication.broadcastMessage("Alerta general")
```

Envia un mensaje a todos los dispositivos en el canal de comunicacion, independientemente del grupo.

#### Recibir Mensaje por Difusion

```blocks
communication.onReceivedBroadcast(function(mensaje, emisor) {
    basic.showString(mensaje)
})
```

Define una accion a realizar cuando se recibe un mensaje de difusion de cualquier dispositivo.

#### Recibir Mensaje por Difusion con Emisor Especifico

```blocks
communication.onReceivedBroadcastFrom("Bob", function(mensaje) {
    basic.showString(mensaje)
})
```

Define una accion a realizar cuando se recibe un mensaje de difusion de cualquier dispositivo.

### Valores por Difusion

#### Enviar Valor por Difusion

```blocks
communication.broadcastValue("alerta", "rojo")
```

Envia un valor con nombre a todos los dispositivos en el canal de comunicacion.

#### Recibir Valor por Difusion

```blocks
communication.onReceivedValueBroadcast("alerta", function(valor, emisor) {
    if (valor == "rojo") {
        basic.showIcon(IconNames.No)
    }
})
```

Ejecuta acciones en respuesta a la recepcion de un valor con nombre enviado por cualquier dispositivo en modo de difusion.

#### Recibir Valor por Difusion con Emisor Especifico

```blocks
communication.onReceivedValueBroadcastFrom("Bob", "alerta", function(valor) {
    if (valor == "rojo") {
        basic.showIcon(IconNames.No)
    }
})
```

Ejecuta acciones en respuesta a la recepcion de un valor con nombre enviado por un emisor especifico en modo de difusion.

### Eventos por Difusion

#### Enviar Evento por Difusion

```blocks
communication.broadcastEvent("evacuar")
```

Envia un evento a todos los dispositivos en el canal de comunicacion, lo que puede desencadenar acciones especificas en los receptores.

#### Recibir Evento por Difusion

```blocks
communication.onReceivedEventBroadcastWithEvent("evacuar", function(emisor) {
    basic.showIcon(IconNames.Skull)
})
```

Ejecuta acciones en respuesta a la recepcion de un evento especifico enviado por cualquier dispositivo en modo de difusion.

#### Recibir Evento por Difusion con Emisor Especifico

```blocks
communication.onReceivedEventBroadcastFromWithEvent("Bob", "evacuar", function() {
    basic.showIcon(IconNames.Skull)
})
```

Ejecuta acciones en respuesta a la recepcion de un evento especifico enviado por un emisor especifico en modo de difusion.

### Proximidad

#### Encontrar Dispositivo Mas Cercano

```blocks
let dispositivoCercano = communication.findClosestDevice()
basic.showString(dispositivoCercano)
```

Este bloque devuelve el nombre del dispositivo mas cercano basado en la intensidad de la senal de radio recibida.

#### Encontrar Dispositivo Mas Cercano en un Grupo

```blocks
let dispositivoCercanoGrupo = communication.findClosestDeviceInGroup("Exploradores")
basic.showString(dispositivoCercanoGrupo)
```

Similar al bloque anterior, pero restringe la busqueda al grupo especificado, devolviendo el dispositivo mas cercano dentro de ese grupo.

#### Metadatos (utilizados para busqueda, renderizado)

-   for PXT/microbit
<script src="https://makecode.com/gh-pages-embed.js"></script><script>makeCodeRender("{{ site.makecode.home_url }}", "{{ site.github.owner_name }}/{{ site.github.repository_name }}");</script>
