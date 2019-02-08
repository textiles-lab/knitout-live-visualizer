;!knitout-2
;;Carriers: A B C D

; tests for yarn carrier crossing

inhook A B C D
knit + f1 B
knit + f2 B
knit + f4 B
knit + f5 B
knit - f5 B

knit + f1 A
knit + f2 A
knit + f3 A
knit + f4 A
knit + f5 A

knit + f1 C
knit + f2 C
knit + f3 C
knit + f4 C
knit + f5 C

xfer f1 b1
xfer f2 b2
xfer f3 b3
xfer f4 b4
xfer f5 b5

knit + b1 A
knit + b2 A
knit + b3 A
knit + b4 A
knit + b5 A

knit + b1 C
knit + b2 C
knit + b3 C
knit + b4 C
knit + b5 C

xfer b1 f1
xfer b2 f2
xfer b3 f3
xfer b4 f4
xfer b5 f5

knit + f1 A C
knit + f2 A C
knit + f3 A C
knit + f4 A C
knit + f5 A C

xfer f1 b1
xfer f2 b2
xfer f3 b3
xfer f4 b4
xfer f5 b5

knit + b1 A C
knit + b2 A C
knit + b3 A C
knit + b4 A C
knit + b5 A C

xfer b1 f1
xfer b2 f2
xfer b3 f3
xfer b4 f4
xfer b5 f5

drop f1
drop f2
drop f3
drop f4
drop f5
