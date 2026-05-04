import React,{useEffect} from "react"
import { Row, Col, Card, CardBody, CardTitle } from "reactstrap"

import { connect } from "react-redux";

//Import Action to copy breadcrumb items from local state to redux state
import { setBreadcrumbItems } from "../../../store/actions";


const EditRoaster = (props) => {
  document.title = "Security Profile";

  
  const breadcrumbItems = [
    { title: "Security", link: "#" },
    { title: "Profile", link: "#" },
    { title: "Security Profile", link: "#" },
  ]

  useEffect(() => {
    props.setBreadcrumbItems('Security Profile', breadcrumbItems)
  })

  return (
    <React.Fragment>

          <Row>
            <Col className="col-12">
              <Card>
                <CardBody>
                  <CardTitle className="h4">Default Datatable </CardTitle>
                  <p className="card-title-desc">
                    mdbreact DataTables has most features enabled by default, so
                    all you need to do to use it with your own tables is to call
                    the construction function:{" "}
                    <code>&lt;MDBDataTable /&gt;</code>.
                  </p>
                </CardBody>
              </Card>
            </Col>
          </Row>
        
    </React.Fragment>
  )
}

export default connect(null, { setBreadcrumbItems })(EditRoaster);