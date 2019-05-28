#include <SoftwareSerial.h>

#define BLUETOOTH_DISABLED_MS 10000
#define BLUETOOTH_ENABLED_MS 10000

SoftwareSerial bluetooth(4, 5); // RX, TX

void setup()
{
  // Start the hardware serial port
  Serial.begin(9600);
  pinMode(5, OUTPUT);  // Bluetooth serial TX
  pinMode(9, OUTPUT);  // Activate bluetooth serial
  pinMode(8, INPUT);   // Bluetooth serial connection enstablished
  pinMode(13, OUTPUT); // Onboard LED

  digitalWrite(13, LOW); // switch OFF LED
  digitalWrite(9, HIGH); // Turn on bluetooth serial
}

bool bluetoothEnabled = false;
unsigned long int bluetoothEventTs = 0;
char deviceName[20] = "New Time3";

void loop()
{
  int bluetoothConnectionEnstablished = digitalRead(8) == HIGH;
  if (bluetoothEnabled == false && millis() - bluetoothEventTs > BLUETOOTH_DISABLED_MS)
  {
    enableBluetooth();
  }
  if (bluetoothEnabled == true && millis() - bluetoothEventTs > BLUETOOTH_ENABLED_MS && bluetoothConnectionEnstablished == false)
  {
    disableBluetooth();
  }
  // while there is data coming in, read it
  // and send to the hardware serial port:
  while (bluetooth.available() > 0)
  {
    char inByte = bluetooth.read();
    bool nameRequested = inByte & 0x1;
    bool eventsRequested = inByte & 0x2;
    char *message = buildMessage(nameRequested, eventsRequested);
    sendMessage(message);
    free(message);
  }
}

void enableBluetooth()
{
  bluetooth.begin(9600);
  bluetooth.listen();
  bluetoothEnabled = true;
  bluetoothEventTs = millis();
  digitalWrite(9, HIGH);
  digitalWrite(5, HIGH);
}

void disableBluetooth()
{
  bluetooth.end();
  digitalWrite(9, LOW);
  digitalWrite(5, LOW);
  bluetoothEnabled = false;
  bluetoothEventTs = millis();
}

struct timeEvent
{
  unsigned long timestampStart;
  int position;
};

char *buildMessage(bool nameRequested, bool eventsRequested)
{
  // Simulates 6 events
  timeEvent timeEvents[] = {
      {12345, 1},
      {12345, 2},
      {12345, 3},
      {12345, 4},
      {12345, 5},
      {12345, 6}};

  char *message = (char *)malloc(400);
  bool firstField = true;
  message[0] = 0x0;
  strcat(message, "{");

  if (nameRequested)
  {
    if (firstField == false)
    {
      strcat(message, ",");
    }
    char nameFormatted[30];
    sprintf(nameFormatted, "\"name\":\"%s\"", deviceName);
    strcat(message, nameFormatted);
    firstField = false;
  }

  if (eventsRequested)
  {
    if (firstField == false)
    {
      strcat(message, ",");
    }
    strcat(message, "\"events\":[");

    for (int i = 0; i < 6; i++)
    {
      char timeEventFormatted[100];
      sprintf(timeEventFormatted, "{\"ts\":%ld, \"pos\":%d}", timeEvents[i].timestampStart, timeEvents[i].position);
      if (i == 0)
      {
        strcat(message, timeEventFormatted);
      }
      else
      {
        strcat(message, ",");
        strcat(message, timeEventFormatted);
      }
    }
    strcat(message, "]");

    firstField = false;
  }

  strcat(message, "}");

  return message;
}

void sendMessage(char *message)
{
  char messageLength[6];
  itoa(strlen(message), messageLength, 10);
  for (int i = 0; messageLength[i] != NULL; i++)
  {
    bluetooth.write(messageLength[i]);
  }
  int zero = 0x0;
  bluetooth.write(zero);
  for (int i = 0; message[i] != NULL; i++)
  {
    bluetooth.write(message[i]);
  }
}
