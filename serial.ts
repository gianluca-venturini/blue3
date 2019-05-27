import noble from 'noble';

const ECHO_SERVICE_UUID = 'ffe0';
const ECHO_CHARACTERISTIC_UUID = 'ffe1';

enum BluetoothState {
  UNKNOWN = 'UNKNOWN',
  POWER_OFF = 'POWER_OFF',
  POWER_ON = 'POWER_ON',
}

/**
 * Continuously search the bluetooth serial with the pre-defined characteristics.
 * Once the bluetooth serial is found attempt to connect and fetch data from it.
 */
class Blue3 {
  private bluetoothState: BluetoothState = BluetoothState.UNKNOWN;
  private bluetoothStateChange?: () => void;
  private peripheralIds?: Set<string>;

  constructor(bluetoothStateChange?: () => void) {
    this.bluetoothStateChange = bluetoothStateChange;
    noble.on('stateChange', this.handleStateChange);
    noble.on('discover', this.handleDiscover);
  }

  getBluetoothState = () => {
    return this.bluetoothState;
  };

  startScanning = (peripheralIds?: string[]) => {
    this.peripheralIds = new Set(peripheralIds);
    noble.startScanning([ECHO_SERVICE_UUID]);
  };

  private handleStateChange = (state: string) => {
    if (state === 'poweredOn') {
      console.log('Scanning');
      this.setBluetoothStateChange(BluetoothState.POWER_ON);
    } else {
      console.log('Bluetooth not powered on');
      this.setBluetoothStateChange(BluetoothState.POWER_OFF);
      noble.stopScanning();
    }
  };

  private setBluetoothStateChange = (state: BluetoothState) => {
    this.bluetoothState = state;
    if (this.bluetoothStateChange) {
      this.bluetoothStateChange();
    }
  };

  private handleDiscover = (peripheral: noble.Peripheral) => {
    if (this.peripheralIds && this.peripheralIds.has(peripheral.id)) {
      noble.stopScanning();
      console.log(
        `Connecting to '${peripheral.advertisement.localName}' ${
          peripheral.id
        }`,
      );
      // connect to the peripheral
      this.fetch(
        peripheral,
        this.handleServicesAndCharacteristicsDiscovered,
        Buffer.from('03', 'hex'), // Request events and name
        this.handleNameMessage,
      );
    } else {
      this.fetch(
        peripheral,
        this.handleServicesAndCharacteristicsDiscovered,
        Buffer.from('01', 'hex'), // Request name
        this.handleEventsMessage,
      );
    }
    peripheral.on('disconnect', this.handlePeripheralDisconnect);
  };

  private handlePeripheralDisconnect = () => {
    console.log('disconnected');
  };

  private fetch = <T>(
    peripheral: noble.Peripheral,
    handleServicesAndCharacteristicsDiscovered: <T>(
      error: string,
      services: noble.Service[],
      characteristics: noble.Characteristic[],
      peripheral: noble.Peripheral,
      request: Buffer,
      callback: (response: T) => void,
    ) => void,
    request: Buffer,
    callback: (response: T) => void,
  ) => {
    peripheral.connect(error => {
      console.log('Connected to', peripheral.id);

      // specify the services and characteristics to discover
      const serviceUUIDs = [ECHO_SERVICE_UUID];
      const characteristicUUIDs = [ECHO_CHARACTERISTIC_UUID];

      peripheral.discoverSomeServicesAndCharacteristics(
        serviceUUIDs,
        characteristicUUIDs,
        (error, services, characteristics) =>
          handleServicesAndCharacteristicsDiscovered(
            error,
            services,
            characteristics,
            peripheral,
            request,
            callback,
          ),
      );
    });
  };

  private handleEventsMessage = (message: any) => {
    console.log('Correctly synched status ', message);
  };

  private handleNameMessage = (message: any) => {
    console.log('Correctly found device name ', message);
  };

  private handleServicesAndCharacteristicsDiscovered = <T>(
    error: string,
    services: noble.Service[],
    characteristics: noble.Characteristic[],
    peripheral: noble.Peripheral,
    request: Buffer,
    callback: (response: T) => void,
  ) => {
    console.log('Discovered services and characteristics');
    const echoCharacteristic = characteristics[0];

    let receptionBuffer: Buffer | undefined;
    let messageLength: number | undefined;

    // data callback receives notifications
    echoCharacteristic.on('data', (data: Buffer, isNotification: boolean) => {
      console.log('Received: "' + data + '"');
      if (data.includes(0x0)) {
        console.log('FOUND');
        const numberLength = data.indexOf(0x0);
        messageLength = parseInt(data.slice(0, numberLength).toString());
        receptionBuffer = data.slice(numberLength + 1);
        console.log(`Message length ${messageLength}`);
      } else {
        if (receptionBuffer === undefined) {
          throw 'Protocol violation: reception buffer undefined.';
        } else {
          receptionBuffer = Buffer.concat([receptionBuffer, data]);
        }
      }

      if (receptionBuffer !== undefined && messageLength !== undefined) {
        if (receptionBuffer.length === messageLength) {
          console.log('Message reception completed');
          const response = JSON.parse(receptionBuffer.toString());
          callback(response);
          peripheral.disconnect();
          receptionBuffer = undefined;
        } else if (receptionBuffer.length > messageLength) {
          throw `Protocol violation: reception buffer larger than expected expeted: ${messageLength} actual ${
            receptionBuffer.length
          }.`;
        }
      }
    });

    // subscribe to be notified whenever the peripheral update the characteristic
    echoCharacteristic.subscribe(error => {
      if (error) {
        console.error('Error subscribing to echoCharacteristic');
      } else {
        console.log('Subscribed for echoCharacteristic notifications');
      }
    });

    // create an interval to send data to the service
    let count = 0;
    setTimeout(() => {
      count++;
      console.log("Sending:  '" + request.toString('hex') + "'");
      echoCharacteristic.write(request, false);
    }, 1000);
  };
}

const ids = ['c42098b64e5343ed8be4f7bde8f5ce63'];

const blue3 = new Blue3(() => {
  if (blue3.getBluetoothState() === BluetoothState.POWER_ON) {
    blue3.startScanning(ids);
  }
});
