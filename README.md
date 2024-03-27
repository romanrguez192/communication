> Open this page at [https://romanrguez192.github.io/communication/](https://romanrguez192.github.io/communication/)

## Use as Extension

This repository can be added as an **extension** in MakeCode.

-   open [https://makecode.microbit.org/](https://makecode.microbit.org/)
-   click on **New Project**
-   click on **Extensions** under the gearwheel menu
-   search for **https://github.com/romanrguez192/communication** and import

## Edit this project

To edit this repository in MakeCode.

-   open [https://makecode.microbit.org/](https://makecode.microbit.org/)
-   click on **Import** then click on **Import URL**
-   paste **https://github.com/romanrguez192/communication** and click import

## Bloques Disponibles

La extension "Comunicacion" para MakeCode ofrece una serie de bloques para facilitar la comunicacion entre dispositivos micro:bit, enfocandose en la configuracion de la red, envio y recepcion de mensajes, sincronizacion de dispositivos, y determinacion de proximidad entre dispositivos. A continuacion se presentan ejemplos de como utilizar estos bloques en tus proyectos.

### Configuracion

#### Establecer canal de comunicacion

```blocks
communication.setChannel(1)
```

Este bloque configura el canal de comunicacion a utilizar, permitiendo que multiples dispositivos micro:bit se comuniquen entre si de manera aislada de otras redes.

#### Registrar dispositivo con nombre

```blocks
communication.registerDevice("Alice")
```

Asigna un nombre identificativo a tu dispositivo micro:bit para facilitar su reconocimiento en la red de comunicaciones.

### Grupos

#### Unirse al grupo

```blocks
communication.joinGroup("Grupo1")
```

Incorpora tu dispositivo a un grupo de comunicacion especifico, permitiendo la interaccion solamente con los dispositivos pertenecientes a este grupo.

#### Salir del grupo

```blocks
communication.leaveGroup("Grupo1")
```

Desvincula tu dispositivo de un grupo de comunicacion especifico, cesando la recepcion de mensajes de dicho grupo.

### Sincronizacion

#### Esperar que un numero especifico de dispositivos se conecten

```blocks
communication.waitForDevices(2)
```

Este bloque pausa la ejecucion del programa hasta que un numero determinado de dispositivos se hayan conectado a la red.

#### Esperar que un dispositivo especifico se conecte

```blocks
communication.waitForDevice("Bob")
```

Detiene la ejecucion del programa hasta que el dispositivo con el nombre especificado se haya conectado.

#### Esperar en un punto de encuentro

```blocks
communication.synchronizationBarrierDirect("Alice", "punto1")
```

Permite sincronizar dispositivos en un punto especifico del programa, esperando a que un dispositivo en particular alcance dicho punto.

### Mensajes Directos

#### Enviar mensaje a un dispositivo

```blocks
communication.sendDirectMessage("Bob", "Hola")
```

Envia un mensaje directamente a un dispositivo especifico identificado por su nombre.

#### Recibir mensaje de cualquier dispositivo

```blocks
communication.onDirectMessageReceived(function(mensaje, emisor) {
    basic.showString(mensaje)
})
```

Define una accion a realizar cuando se recibe un mensaje directo de cualquier dispositivo.

### Eventos Directos

#### Enviar evento a un dispositivo

```blocks
communication.sendDirectEvent("Bob", "inicio")
```

Envia una notificacion de evento a un dispositivo especifico, lo cual puede ser utilizado para desencadenar acciones especificas en el receptor.

#### Escuchar por un evento especifico

```blocks
communication.onDirectEventReceivedWithEvent("inicio", function(emisor) {
    basic.showString("Inicio desde " + emisor)
})
```

Ejecuta acciones en respuesta a la recepcion de un evento especifico enviado por cualquier dispositivo.

### Proximidad

#### Encontrar dispositivo mas cercano

```blocks
let cercano = communication.findClosestDevice()
basic.showString(cercano)
```

Identifica el dispositivo mas cercano basandose en la intensidad de la senal de radio recibida, util para aplicaciones que requieren interaccion basada en proximidad fisica.

Estos ejemplos representan solo una parte de las capacidades de la extension "Comunicacion". Experimenta con los distintos bloques y parametros para descubrir todas las posibilidades que ofrece esta herramienta en tus proyectos con micro:bit.

#### Metadata (used for search, rendering)

-   for PXT/microbit
<script src="https://makecode.com/gh-pages-embed.js"></script><script>makeCodeRender("{{ site.makecode.home_url }}", "{{ site.github.owner_name }}/{{ site.github.repository_name }}");</script>
